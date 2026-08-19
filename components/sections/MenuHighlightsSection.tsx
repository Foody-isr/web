"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { SectionProps } from "./SectionRenderer";
import { getFieldStyle, getFieldSizeClass, ensureFont } from "./typography";
import { getSectionBg } from "./sectionBg";

type FeaturedItem = {
  id: number;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
};

/**
 * Featured products carousel section.
 * Fetches menu items by IDs and displays them in a horizontal carousel.
 *
 * Content: { title, subtitle, item_ids: number[] }
 * Settings: standard bg/overlay + title/subtitle typography
 */
export function MenuHighlightsSection({ section, restaurant }: SectionProps) {
  const content = section.content || {};
  const settings = section.settings || {};
  const title = content.title || "";
  const subtitle = content.subtitle || "";
  const itemIds: number[] = content.item_ids || [];
  const bg = getSectionBg(settings);

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

  useEffect(() => {
    if (itemIds.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "";
    const rid = restaurant?.id || "";
    fetch(`${apiBase}/api/v1/public/menu?restaurant_id=${rid}`)
      .then((res) => res.json())
      .then((data) => {
        // Public menu shape (post Groups migration): { menus: [{ groups: [{ items: [...] }] }] }.
        // The same item can appear in multiple groups across menus, so dedup by id below.
        const flatItems: FeaturedItem[] = (data.menus || []).flatMap((menu: any) =>
          (menu.groups || []).flatMap((group: any) =>
            (group.items || []).map((item: any) => ({
              id: item.id,
              name: item.name || item.Name,
              description: item.description || item.Description || "",
              price: Number(item.price ?? 0),
              imageUrl: item.image_url || item.imageUrl || "",
            }))
          )
        );
        // Dedup by id (same item can be in multiple groups), then filter to
        // selected IDs preserving the admin's chosen order.
        const idSet = new Set(itemIds);
        const map = new Map<number, FeaturedItem>();
        for (const it of flatItems) {
          if (idSet.has(it.id) && !map.has(it.id)) map.set(it.id, it);
        }
        const ordered = itemIds.map((id) => map.get(id)).filter(Boolean) as FeaturedItem[];
        setItems(ordered);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemIds.join(","), restaurant?.id]);

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
    scrollRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
  }

  // Currency formatting
  const formatPrice = (price: number) =>
    new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS" }).format(price);

  const hasFieldTitle = settings.title_color || settings.title_font || settings.title_size || settings.title_weight;
  const hasFieldSubtitle = settings.subtitle_color || settings.subtitle_font || settings.subtitle_size || settings.subtitle_weight;

  if (itemIds.length === 0 && !title) return null;

  return (
    <section className={`relative py-16 px-6 ${bg.className}`} style={bg.style}>
      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Header */}
        {(title || subtitle) && (
          <div className="text-center mb-10">
            {title && (
              <h2
                className={`${hasFieldTitle ? getFieldSizeClass(settings, "title", true) : "text-2xl md:text-3xl"} mb-2`}
                style={hasFieldTitle ? { fontWeight: 700, ...getFieldStyle(settings, "title") } : { fontWeight: 700 }}
              >
                {title}
              </h2>
            )}
            {subtitle && (
              <p
                className={`${hasFieldSubtitle ? getFieldSizeClass(settings, "subtitle", false) : "text-base md:text-lg"} opacity-80`}
                style={hasFieldSubtitle ? getFieldStyle(settings, "subtitle") : undefined}
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
                className="flex-shrink-0 w-[280px] h-[360px] rounded-2xl bg-[var(--surface)] animate-pulse"
              />
            ))}
          </div>
        ) : items.length > 0 ? (
          <div className="relative group">
            {/* Left arrow */}
            {canScrollLeft && (
              <button
                onClick={() => scrollBy(-1)}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-20 w-10 h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center hover:bg-white transition opacity-0 group-hover:opacity-100"
                aria-label="Scroll left"
              >
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {/* Scrollable container */}
            <div
              ref={scrollRef}
              className="flex gap-5 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {items.map((item) => (
                <Link
                  key={item.id}
                  href={orderUrl}
                  className="flex-shrink-0 w-[280px] rounded-2xl overflow-hidden bg-[var(--surface)] shadow-md hover:shadow-xl transition-shadow group/card"
                >
                  {/* Image */}
                  <div className="relative w-full h-[200px] bg-[var(--surface-subtle)]">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        fill
                        className="object-cover group-hover/card:scale-105 transition-transform duration-300"
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
                    <h3 className="font-semibold text-[var(--text)] text-base leading-tight mb-1 line-clamp-2">
                      {item.name}
                    </h3>
                    {item.description && (
                      <p className="text-sm text-[var(--text-muted)] line-clamp-2 mb-3">
                        {item.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[var(--brand)] text-lg">
                        {formatPrice(item.price)}
                      </span>
                      <span className="text-xs font-medium text-[var(--brand)] bg-[var(--brand)]/10 px-3 py-1 rounded-full">
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
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-20 w-10 h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center hover:bg-white transition opacity-0 group-hover:opacity-100"
                aria-label="Scroll right"
              >
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          <p className="text-center text-[var(--text-muted)]">
            No featured items selected.
          </p>
        )}
      </div>
    </section>
  );
}
