"use client";

import { useRef, useMemo, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  MotionValue,
} from "framer-motion";
import { SectionProps } from "./SectionRenderer";
import { getFieldStyle, getFieldSizeClass, ensureFont } from "./typography";
import { getSectionBg } from "./sectionBg";

type FoodItem = {
  url: string;
  alt?: string;
};

/** Default placeholder items when no images are configured. */
const PLACEHOLDER_ITEMS: FoodItem[] = [
  { url: "", alt: "Challah" },
  { url: "", alt: "Salad" },
  { url: "", alt: "Main Dish" },
  { url: "", alt: "Side Dish" },
  { url: "", alt: "Dessert" },
  { url: "", alt: "Drink" },
];

/** Seeded random for deterministic layout per index. */
function seededRandom(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

/** Per-item animation: fall from top, land in basket, shrink. */
function FallingItem({
  item,
  index,
  total,
  scrollProgress,
  basketY,
  containerWidth,
}: {
  item: FoodItem;
  index: number;
  total: number;
  scrollProgress: MotionValue<number>;
  basketY: number;
  containerWidth: number;
}) {
  // Stagger: each item animates in its own scroll slice
  const staggerStart = (index / total) * 0.7;
  const staggerEnd = staggerStart + 0.3;

  // Horizontal position: spread items across the container with slight randomness
  const baseX = ((index % 3) - 1) * (containerWidth * 0.25);
  const offsetX = (seededRandom(index + 7) - 0.5) * 60;
  const startX = baseX + offsetX;

  // Vertical: start at top of container, land inside the basket
  // basketY is the top of the basket element; the opening/rim is ~55px below that
  const startY = 0;
  const basketRimY = basketY + 70; // where the basket opening is (larger basket)
  const endY = basketRimY + 20;    // slightly past the rim, into the basket

  // Slight rotation for organic feel
  const startRotate = (seededRandom(index + 3) - 0.5) * 30;

  const rawY = useTransform(scrollProgress, [staggerStart, staggerEnd], [startY, endY]);
  const y = useSpring(rawY, { stiffness: 80, damping: 18 });

  const rawX = useTransform(scrollProgress, [staggerStart, staggerEnd * 0.8, staggerEnd], [startX, startX * 0.3, 0]);
  const x = useSpring(rawX, { stiffness: 60, damping: 16 });

  // Shrink to a small size as items "drop into" the basket
  const rawScale = useTransform(scrollProgress, [staggerStart, staggerEnd * 0.6, staggerEnd * 0.85, staggerEnd], [1, 0.9, 0.5, 0.2]);
  const scale = useSpring(rawScale, { stiffness: 100, damping: 20 });

  const rawRotate = useTransform(scrollProgress, [staggerStart, staggerEnd], [startRotate, 0]);
  const rotate = useSpring(rawRotate, { stiffness: 60, damping: 14 });

  // Fade in at start, stay visible during fall, fade out as item enters basket
  const opacity = useTransform(scrollProgress, [staggerStart, staggerStart + 0.02, staggerEnd * 0.85, staggerEnd], [0, 1, 1, 0]);

  const itemSize = 130;

  return (
    <motion.div
      style={{ x, y, scale, rotate, opacity, position: "absolute", left: "50%", marginLeft: -itemSize / 2, zIndex: total - index }}
      className="pointer-events-none"
    >
      <div
        className="rounded-full shadow-lg overflow-hidden border-2 border-white/80 bg-amber-50"
        style={{ width: itemSize, height: itemSize }}
      >
        {item.url ? (
          <Image
            src={item.url}
            alt={item.alt || `Dish ${index + 1}`}
            width={itemSize}
            height={itemSize}
            className="object-cover w-full h-full"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">
            {["🍞", "🥗", "🍲", "🥘", "🍰", "🥤", "🧆", "🫓"][index % 8]}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Picnic basket scroll animation section.
 * Food items fall from the top and land in a basket as the user scrolls.
 *
 * Content: { items: [{url, alt}], basket_image, title, subtitle, completion_text }
 * Settings: { color_style, custom_bg, custom_text, title_color, title_font, title_size, title_weight, subtitle_*, completion_* }
 */
export function PicnicBasketSection({ section }: SectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const content = section.content || {};
  const settings = section.settings || {};

  const items: FoodItem[] =
    Array.isArray(content.items) && content.items.length > 0
      ? content.items
      : PLACEHOLDER_ITEMS;

  const title = content.title || "";
  const subtitle = content.subtitle || "";

  // Load custom fonts for this section's text fields
  useEffect(() => {
    ensureFont(settings.title_font);
    ensureFont(settings.subtitle_font);
    ensureFont(settings.completion_font);
  }, [settings.title_font, settings.subtitle_font, settings.completion_font]);

  const bg = getSectionBg(settings);

  // Scroll tracking over the entire section height
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  // Basket dimensions
  const basketWidth = 300;
  const basketY = 320; // px from section center where basket sits

  // Glow when basket is full (scroll near end)
  const glowOpacity = useTransform(scrollYProgress, [0.85, 1], [0, 1]);
  const glowScale = useSpring(
    useTransform(scrollYProgress, [0.85, 1], [0.95, 1.05]),
    { stiffness: 80, damping: 12 }
  );

  // Basket subtle bounce at the end
  const basketBounce = useSpring(
    useTransform(scrollYProgress, [0.9, 0.95, 1], [0, -8, 0]),
    { stiffness: 200, damping: 10 }
  );

  const containerWidth = 700; // wider to accommodate larger items

  // Memoize items to avoid re-render churn
  const itemElements = useMemo(
    () =>
      items.map((item, i) => (
        <FallingItem
          key={i}
          item={item}
          index={i}
          total={items.length}
          scrollProgress={scrollYProgress}
          basketY={basketY}
          containerWidth={containerWidth}
        />
      )),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items.length, basketY, containerWidth]
  );

  return (
    <section
      ref={containerRef}
      className={`relative ${bg.className}`}
      style={{ ...bg.style, minHeight: "180vh" }}
    >
      {/* Sticky viewport so the animation stays visible while scrolling */}
      <div className="sticky top-[60px] h-[calc(100vh-60px)] flex flex-col items-center justify-center overflow-hidden" style={{ zIndex: 2 }}>
        {/* Title area — high z-index + text shadow for readability over bg images */}
        {(title || subtitle) && (
          <div className="text-center mb-8 px-4" style={{ position: "relative", zIndex: 20, textShadow: "0 2px 8px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.3)" }}>
            {title && (
              <h2
                className={`${getFieldSizeClass(settings, 'title', true)} mb-2`}
                style={{ fontWeight: 700, color: "#ffffff", ...getFieldStyle(settings, 'title') }}
              >
                {title}
              </h2>
            )}
            {subtitle && (
              <p
                className={`${getFieldSizeClass(settings, 'subtitle', false)}`}
                style={{ color: "rgba(255,255,255,0.9)", ...getFieldStyle(settings, 'subtitle') }}
              >
                {subtitle}
              </p>
            )}
          </div>
        )}

        {/* Animation container */}
        <div className="relative overflow-hidden" style={{ width: containerWidth, height: basketY + 240 }}>
          {/* Falling food items */}
          {itemElements}

          {/* Basket */}
          <motion.div
            className="absolute left-1/2 flex flex-col items-center"
            style={{
              top: basketY,
              marginLeft: -basketWidth / 2,
              y: basketBounce,
            }}
          >
            {/* Glow effect */}
            <motion.div
              className="absolute inset-0 rounded-3xl"
              style={{
                opacity: glowOpacity,
                scale: glowScale,
                background: "radial-gradient(ellipse at center, rgba(251,191,36,0.3) 0%, transparent 70%)",
                width: basketWidth + 60,
                height: 220,
                marginLeft: -20,
                marginTop: -20,
              }}
            />
            {/* Basket — clickable link */}
            {(() => {
              const basketLink = content.basket_link || "/order";
              const basketContent = (
                <>
                  {content.basket_image ? (
                    <Image
                      src={content.basket_image}
                      alt="Picnic basket"
                      width={basketWidth}
                      height={180}
                      className="object-contain relative z-10"
                    />
                  ) : (
                    <svg
                      width={basketWidth}
                      height={180}
                      viewBox="0 0 200 120"
                      className="relative z-10"
                      aria-label="Picnic basket"
                    >
                      <ellipse cx="100" cy="80" rx="90" ry="35" fill="#8B6914" />
                      <ellipse cx="100" cy="80" rx="90" ry="35" fill="url(#basketWeave)" />
                      <ellipse cx="100" cy="75" rx="85" ry="30" fill="#A07818" />
                      <ellipse cx="100" cy="55" rx="88" ry="12" fill="#6B4F10" />
                      <ellipse cx="100" cy="55" rx="85" ry="10" fill="#8B6914" />
                      <ellipse cx="100" cy="60" rx="78" ry="18" fill="#5A3E0A" opacity="0.4" />
                      <path d="M 40 55 Q 100 -15 160 55" fill="none" stroke="#6B4F10" strokeWidth="6" strokeLinecap="round" />
                      <path d="M 42 55 Q 100 -12 158 55" fill="none" stroke="#8B6914" strokeWidth="4" strokeLinecap="round" />
                      <defs>
                        <pattern id="basketWeave" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
                          <rect width="12" height="12" fill="transparent" />
                          <line x1="0" y1="6" x2="12" y2="6" stroke="#7A5A10" strokeWidth="1" opacity="0.3" />
                          <line x1="6" y1="0" x2="6" y2="12" stroke="#7A5A10" strokeWidth="1" opacity="0.3" />
                        </pattern>
                      </defs>
                      <path d="M 30 58 Q 50 48 70 56 Q 90 48 110 56 Q 130 48 150 56 Q 170 48 175 58" fill="none" stroke="#E8D5B7" strokeWidth="3" opacity="0.6" />
                    </svg>
                  )}
                </>
              );
              return (
                <Link
                  href={basketLink}
                  className="relative z-10 cursor-pointer pointer-events-auto transition-transform hover:scale-105 flex flex-col items-center"
                >
                  {basketContent}
                </Link>
              );
            })()}
            {/* "Ready for Shabbat" text that fades in at the end */}
            <motion.p
              className={`mt-4 ${getFieldSizeClass(settings, 'completion', false)} text-center`}
              style={{
                opacity: useTransform(scrollYProgress, [0.88, 1], [0, 1]),
                fontWeight: 500,
                ...getFieldStyle(settings, 'completion'),
              }}
            >
              {content.completion_text || "Ready for Shabbat! 🕯️"}
            </motion.p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
