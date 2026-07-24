"use client";

import Image from "next/image";
import Link from "next/link";
import { SectionProps } from "./SectionRenderer";
import { getSectionBg } from "./sectionBg";
import { getHeadingClass } from "./typography";

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
function resolveCardLink(link: string | undefined, slug: string): string | null {
  if (!link) return null;
  if (link.startsWith("http://") || link.startsWith("https://") || link.startsWith("#")) return link;
  const path = link.startsWith("/") ? link : `/${link}`;
  return `/r/${slug}${path}`;
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
            const href = resolveCardLink(card.link, slug);
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
                    <span className="bg-white/95 px-6 py-2.5 text-sm font-semibold uppercase tracking-wide text-[var(--text,#111)] shadow-sm">
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
