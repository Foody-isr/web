"use client";

import Image from "next/image";
import Link from "next/link";
import { SectionProps } from "./SectionRenderer";
import { getSectionBg } from "./sectionBg";
import { getHeadingClass } from "./typography";
import { resolveRestaurantCardHref } from "@/lib/orderDiscovery";

type FeatureCardButtonSettings = {
  button_bg_color?: unknown;
  button_text_color?: unknown;
  button_border_color?: unknown;
  button_shape?: unknown;
};

type FeatureCard = {
  image_url?: string;
  title?: string;
  subtitle?: string;
  link?: string;
};

/**
 * Resolve a card link relative to the restaurant base path. Absolute URLs
 * (http/https) and anchors (#) are returned as-is; a relative path like
 * "/catering" or a bare page slug is prefixed with /r/{slug}. Mirrors
 * resolveCtaLink in HeroBannerSection so cards can point at /order, /catering,
 * a custom page, an external URL, or an on-page anchor.
 */
/** Returns the static radius class for a feature-card button shape. */
export function featureCardButtonShapeClass(shape: unknown): string {
  if (shape === "pill") return "rounded-full";
  if (shape === "rounded") return "rounded-xl";
  return "rounded-none";
}

/** Returns the dynamic feature-card button colors, preserving legacy defaults. */
export function featureCardButtonStyle(settings: FeatureCardButtonSettings) {
  return {
    backgroundColor:
      typeof settings.button_bg_color === "string" && settings.button_bg_color
        ? settings.button_bg_color
        : "rgba(255, 255, 255, 0.95)",
    color:
      typeof settings.button_text_color === "string" &&
      settings.button_text_color
        ? settings.button_text_color
        : "var(--text, #111)",
    ...(typeof settings.button_border_color === "string" &&
    settings.button_border_color
      ? { borderColor: settings.button_border_color }
      : {}),
  };
}

/**
 * Feature-cards section: a responsive grid of image cards, each with a centered
 * title "button" and an optional subtitle, linking to a page/URL. This is the
 * "Nos Boutiques / Nos Plateaux / Notre Traiteur" style grid.
 * Content: { cards: [{ image_url, title, subtitle?, link }] }
 * Settings: shared section background/colors via getSectionBg.
 */
export function FeatureCardsSection({ section, restaurant }: SectionProps) {
  const slug = restaurant?.slug || restaurant?.id?.toString() || "";
  const settings = section.settings || {};
  const bg = getSectionBg(settings, "light");
  const title = section.content?.title as string | undefined;
  const cards: FeatureCard[] = Array.isArray(section.content?.cards) ? section.content.cards : [];
  const buttonShapeClass = featureCardButtonShapeClass(settings.button_shape);
  const buttonStyle = featureCardButtonStyle(settings);
  const buttonBorderClass = settings.button_border_color ? "border" : "";

  const visible = cards.filter((c) => c.image_url || c.title);
  if (visible.length === 0) return null;

  return (
    <section className={`py-10 md:py-16 ${bg.className}`} style={bg.style}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {title && (
          <h2 className={`${getHeadingClass(settings)} mb-6 text-center`}>{title}</h2>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
          {visible.map((card, i) => {
            const href = resolveRestaurantCardHref(card.link, slug);
            const inner = (
              <div className="group relative aspect-[4/3] overflow-hidden rounded-xl">
                {card.image_url ? (
                  <Image
                    src={card.image_url}
                    alt={card.title || ""}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, 50vw"
                  />
                ) : (
                  <div className="absolute inset-0 bg-[var(--surface-2,#1a1a1a)]" />
                )}
                <div className="absolute inset-0 bg-black/25 transition-colors group-hover:bg-black/35" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
                  {card.title && (
                    <span
                      className={`${buttonShapeClass} ${buttonBorderClass} px-6 py-2.5 text-sm font-semibold uppercase tracking-wide shadow-sm`}
                      style={buttonStyle}
                    >
                      {card.title}
                    </span>
                  )}
                  {card.subtitle && (
                    <span className="text-sm text-white/90 drop-shadow">{card.subtitle}</span>
                  )}
                </div>
              </div>
            );
            return href ? (
              <Link key={i} href={href} className="block">
                {inner}
              </Link>
            ) : (
              <div key={i}>{inner}</div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
