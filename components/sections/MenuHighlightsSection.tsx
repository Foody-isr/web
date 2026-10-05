"use client";

import {
  useEffect,
  useState,
  useRef,
  useCallback,
  type CSSProperties,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { fetchMenu } from "@/services/api";
import { useCurrency, useI18n } from "@/lib/i18n";
import { SectionProps } from "./SectionRenderer";
import { getFieldStyle, getFieldSizeClass, ensureFont } from "./typography";
import { getSectionBg } from "./sectionBg";
import {
  styleVariables,
  type CSSVariableStyle,
} from "@/lib/websiteV3Appearance";

type FeaturedItem = {
  id: number;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
};

/** Maps one Menu Highlights section's palette to local semantic variables. */
export function menuHighlightsStyleVariables(
  settings: Record<string, unknown> | null | undefined,
): CSSVariableStyle {
  return styleVariables(settings, [
    ["custom_bg", "--highlight-bg"],
    ["custom_text", "--highlight-text"],
    ["card_bg", "--highlight-card-bg"],
    ["card_text", "--highlight-card-text"],
    ["card_muted", "--highlight-card-muted"],
    ["price_color", "--highlight-price"],
    ["accent_color", "--highlight-accent"],
  ]);
}

/** Resolves the carousel arrow color from the section accent token. */
export function menuHighlightsArrowStyle(): CSSProperties {
  return { color: "var(--highlight-accent, var(--brand))" };
}

/**
 * Featured products carousel section.
 * Fetches menu items by IDs and displays them in a horizontal carousel.
 *
 * Content: { title, subtitle, item_ids: number[] }
 * Settings: standard bg/overlay + title/subtitle typography
 */
export function MenuHighlightsSection({ section, restaurant }: SectionProps) {
  const { money: formatPrice } = useCurrency();
  const { t } = useI18n();
  const content = section.content || {};
  const settings = section.settings || {};
  const title = content.title || "";
  const subtitle = content.subtitle || "";
  const itemIds: number[] = content.item_ids || [];
  const bg = getSectionBg(settings);
  const palette = menuHighlightsStyleVariables(settings);
  const sectionStyle = {
    ...bg.style,
    ...palette,
    ...(palette["--highlight-bg"]
      ? { backgroundColor: "var(--highlight-bg)" }
      : {}),
    ...(palette["--highlight-text"] ? { color: "var(--highlight-text)" } : {}),
  };

  const slug = restaurant?.slug || String(restaurant?.id || "");
  const orderUrl = `/r/${slug}/order`;

  // Load custom fonts
  useEffect(() => {
    ensureFont(settings.title_font);
    ensureFont(settings.subtitle_font);
  }, [settings.title_font, settings.subtitle_font]);

  // Fetch menu items
  const [items, setItems] = useState<FeaturedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const itemKey = itemIds.join(",");

  useEffect(() => {
    let active = true;
    const ids = itemKey.split(",").filter(Boolean).map(Number);
    setItems([]);
    setLoadError(false);
    if (!ids.length || !restaurant?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchMenu(String(restaurant.id))
      .then((data) => {
        const byId = new Map<number, FeaturedItem>();
        for (const item of data.menus.flatMap((menu) => menu.items)) {
          if (!byId.has(Number(item.id)))
            byId.set(Number(item.id), { ...item, id: Number(item.id) });
        }
        if (active)
          setItems(
            ids
              .map((id) => byId.get(id))
              .filter((item): item is FeaturedItem => Boolean(item)),
          );
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [itemKey, restaurant?.id]);

  // Carousel scroll
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll, items]);

  function scrollBy(dir: number) {
    const reducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    scrollRef.current?.scrollBy({
      left: dir * 320,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }

  const hasFieldTitle =
    settings.title_color ||
    settings.title_font ||
    settings.title_size ||
    settings.title_weight;
  const hasFieldSubtitle =
    settings.subtitle_color ||
    settings.subtitle_font ||
    settings.subtitle_size ||
    settings.subtitle_weight;

  if (loadError)
    return (
      <section className="p-12 text-center" role="alert">
        {t("websiteItemsError")}
      </section>
    );
  if (itemIds.length === 0 && !title) return null;

  if (section.sectionType === "featured_menu" || section.layout === "grid")
    return (
      <section
        className={`py-16 px-6 md:px-12 ${bg.className}`}
        style={sectionStyle}
      >
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-12 space-y-4">
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div
            className={
              section.layout === "grid"
                ? "grid sm:grid-cols-2 lg:grid-cols-3 gap-8"
                : "grid md:grid-cols-2 gap-x-14"
            }
          >
            {items.map((item) => (
              <Link
                key={item.id}
                href={`${orderUrl}?item=${item.id}`}
                className="flex gap-5 items-center py-5 border-b border-current/15"
              >
                {item.imageUrl && (
                  <div className="relative shrink-0 w-24 h-24">
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">{item.name}</h3>
                  {item.description && (
                    <p className="text-sm line-clamp-2 opacity-80">
                      {item.description}
                    </p>
                  )}
                  <p className="mt-2">{formatPrice(item.price)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    );

  return (
    <section
      className={`relative py-16 px-6 ${bg.className}`}
      style={sectionStyle}
    >
      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Header */}
        {(title || subtitle) && (
          <div className="text-center mb-10">
            {title && (
              <h2
                className={`${hasFieldTitle ? getFieldSizeClass(settings, "title", true) : "text-2xl md:text-3xl"} mb-2`}
                style={
                  hasFieldTitle
                    ? { fontWeight: 700, ...getFieldStyle(settings, "title") }
                    : { fontWeight: 700 }
                }
              >
                {title}
              </h2>
            )}
            {subtitle && (
              <p
                className={`${hasFieldSubtitle ? getFieldSizeClass(settings, "subtitle", false) : "text-base md:text-lg"} opacity-80`}
                style={
                  hasFieldSubtitle
                    ? getFieldStyle(settings, "subtitle")
                    : undefined
                }
              >
                {subtitle}
              </p>
            )}
          </div>
        )}

        {/* Carousel */}
        {loading ? (
          <div className="flex gap-5 overflow-hidden">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex-shrink-0 w-[280px] h-[360px] rounded-2xl bg-[var(--highlight-card-bg,var(--surface))] animate-pulse motion-reduce:animate-none"
              />
            ))}
          </div>
        ) : items.length > 0 ? (
          <div className="relative group">
            {/* Left arrow */}
            {canScrollLeft && (
              <button
                onClick={() => scrollBy(-1)}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-20 w-10 h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center hover:bg-white transition opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                aria-label="Scroll left"
              >
                <svg
                  className="w-5 h-5"
                  style={menuHighlightsArrowStyle()}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            )}

            {/* Scrollable container */}
            <div
              ref={scrollRef}
              className="flex gap-5 overflow-x-auto scrollbar-hide scroll-smooth pb-2 motion-reduce:scroll-auto"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {items.map((item) => (
                <Link
                  key={item.id}
                  href={orderUrl}
                  className="flex-shrink-0 w-[280px] rounded-2xl overflow-hidden bg-[var(--highlight-card-bg,var(--surface))] shadow-md hover:shadow-xl transition-shadow group/card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                >
                  {/* Image */}
                  <div className="relative w-full h-[200px] bg-[var(--surface-subtle)]">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        fill
                        className="object-cover group-hover/card:scale-105 transition-transform duration-300 motion-reduce:transform-none motion-reduce:transition-none"
                        sizes="280px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl">
                        🍽️
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-semibold text-[var(--highlight-card-text,var(--text))] text-base leading-tight mb-1 line-clamp-2">
                      {item.name}
                    </h3>
                    {item.description && (
                      <p className="text-sm text-[var(--highlight-card-muted,var(--text-muted))] line-clamp-2 mb-3">
                        {item.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[var(--highlight-price,var(--brand))] text-lg">
                        {formatPrice(item.price)}
                      </span>
                      <span
                        className="text-xs font-medium px-3 py-1 rounded-full"
                        style={{
                          color: "var(--highlight-accent, var(--brand))",
                          backgroundColor:
                            "color-mix(in srgb, var(--highlight-accent, var(--brand)) 10%, transparent)",
                        }}
                      >
                        Order
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Right arrow */}
            {canScrollRight && (
              <button
                onClick={() => scrollBy(1)}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-20 w-10 h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center hover:bg-white transition opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                aria-label="Scroll right"
              >
                <svg
                  className="w-5 h-5"
                  style={menuHighlightsArrowStyle()}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            )}
          </div>
        ) : (
          <p className="text-center text-[var(--highlight-card-muted,var(--text-muted))]">
            No featured items selected.
          </p>
        )}
      </div>
    </section>
  );
}
