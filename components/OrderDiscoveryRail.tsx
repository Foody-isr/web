"use client";

import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { Restaurant, WebsiteSection } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { localizeSection } from "@/lib/sectionLocale";
import {
  isOrderDiscoveryLink,
  orderDiscoveryHeading,
  resolveRestaurantCardHref,
} from "@/lib/orderDiscovery";

type DiscoveryCard = {
  image_url?: string;
  title?: string;
  subtitle?: string;
  link?: string;
};

type PreparedCard = DiscoveryCard & {
  href: string;
  accentStyle: CSSProperties;
};

/**
 * A compact, editorial cross-sell rail embedded in the menu. Its source is the
 * homepage feature-card collection, minus links that lead back to ordering.
 */
export function OrderDiscoveryRail({
  sections,
  restaurant,
  orderPageSlug,
}: {
  sections: WebsiteSection[];
  restaurant: Restaurant;
  orderPageSlug: string;
}) {
  const { locale, t, direction } = useI18n();
  const restaurantSlug = restaurant.slug || String(restaurant.id);
  const localizedSections = sections.map((section) =>
    localizeSection(section, locale),
  );
  const cards = localizedSections.flatMap((section) => {
    const candidates = Array.isArray(section.content.cards)
      ? (section.content.cards as DiscoveryCard[])
      : [];
    const accentStyle = discoveryAccentStyle(section.settings);

    return candidates.flatMap((card): PreparedCard[] => {
      if (
        isOrderDiscoveryLink(card.link, orderPageSlug) ||
        (!card.title && !card.image_url)
      ) {
        return [];
      }
      const href = resolveRestaurantCardHref(card.link, restaurantSlug);
      return href ? [{ ...card, href, accentStyle }] : [];
    });
  });

  if (cards.length === 0) return null;

  const automaticHeading = (
    t("discoverMore") || "Discover more from {name}"
  ).replace("{name}", restaurant.name);
  const heading = orderDiscoveryHeading(
    localizedSections[0],
    automaticHeading,
  );
  const isSingleCard = cards.length === 1;
  const layout = isSingleCard
    ? "mx-auto grid max-w-5xl grid-cols-1"
    : cards.length === 2
      ? "flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 no-scrollbar sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0"
      : "flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 no-scrollbar sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 xl:grid-cols-3";

  return (
    <section
      aria-labelledby={heading ? "order-discovery-title" : undefined}
      aria-label={
        heading ? undefined : t("discoverEyebrow") || "Beyond the menu"
      }
      className="col-span-full my-7 border-y border-[var(--divider)] py-7 sm:my-10 sm:py-9"
    >
      {heading || cards.length > 1 ? (
        <div
          className={`mb-5 flex items-end gap-4 ${heading ? "justify-between" : "justify-end"} ${isSingleCard ? "mx-auto max-w-5xl" : ""}`}
        >
          {heading ? (
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {t("discoverEyebrow") || "Beyond the menu"}
              </p>
              <h2
                id="order-discovery-title"
                className="text-2xl font-bold leading-tight text-[var(--text)] sm:text-3xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {heading}
              </h2>
            </div>
          ) : null}
          {cards.length > 1 ? (
            <span className="shrink-0 text-xs font-medium text-[var(--text-muted)] sm:hidden">
              {t("swipeToExplore") || "Swipe to explore"}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className={layout}>
        {cards.map((card, index) => (
          <Link
            key={`${card.href}-${index}`}
            href={card.href}
            className={`${cards.length > 1 ? "h-56 min-w-[82%] snap-start sm:h-64 sm:min-w-0" : "h-56 w-full sm:aspect-[16/7] sm:h-auto"} group relative block overflow-hidden rounded-2xl bg-[var(--surface-subtle)] shadow-[0_10px_30px_var(--shadow-color)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand)]`}
          >
            {card.image_url ? (
              <Image
                src={card.image_url}
                alt=""
                fill
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.035] motion-reduce:transition-none"
                sizes={isSingleCard
                  ? "(max-width: 640px) 100vw, 1024px"
                  : "(max-width: 640px) 82vw, (max-width: 1280px) 50vw, 33vw"}
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/5 transition-colors group-hover:from-black/90" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 text-white sm:p-6">
              <div className="min-w-0">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/75">
                  {t("discoverAction") || "Discover"}
                </p>
                {card.title ? (
                  <h3
                    className="text-xl font-bold leading-tight sm:text-2xl"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {card.title}
                  </h3>
                ) : null}
                {card.subtitle ? (
                  <p className="mt-1 line-clamp-2 max-w-xl text-sm text-white/85">
                    {card.subtitle}
                  </p>
                ) : null}
              </div>
              <span
                aria-hidden="true"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/15 text-xl font-semibold shadow-lg transition-transform group-hover:scale-105"
                style={card.accentStyle}
              >
                {direction === "rtl" ? "←" : "→"}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function discoveryAccentStyle(settings: Record<string, unknown>): CSSProperties {
  return {
    backgroundColor:
      typeof settings.button_bg_color === "string" && settings.button_bg_color
        ? settings.button_bg_color
        : "var(--brand)",
    color:
      typeof settings.button_text_color === "string" && settings.button_text_color
        ? settings.button_text_color
        : "white",
  };
}
