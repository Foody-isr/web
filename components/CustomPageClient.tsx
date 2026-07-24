"use client";

import Link from "next/link";
import Image from "next/image";
import { Restaurant } from "@/lib/types";
import { SectionRenderer } from "@/components/sections/SectionRenderer";
import { SiteFooter } from "@/components/SiteFooter";
import { usePageSections } from "@/lib/usePageSections";

/**
 * Client renderer for a custom website page (/r/<slug>/<page>). Split out from
 * the server route so it can live-preview drafts inside the foodyadmin website
 * builder: in preview mode it announces itself to the editor parent and swaps
 * in the draft sections it receives, exactly like RestaurantLanding does for the
 * landing page. Outside preview it just renders the published sections.
 */
export function CustomPageClient({
  restaurant,
  pageSlug,
}: {
  restaurant: Restaurant;
  pageSlug: string;
}) {
  const slug = restaurant.slug || String(restaurant.id);
  const { sections: pageSections, overrideSections } = usePageSections(restaurant, pageSlug);

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text)]">
      {/* Nav Bar */}
      <nav className="sticky top-0 z-40 bg-[var(--surface)]/95 backdrop-blur-md border-b border-[var(--divider)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link href={`/r/${slug}`} className="flex items-center gap-3">
            {restaurant.logoUrl && (
              <Image
                src={restaurant.logoUrl}
                alt={restaurant.name}
                width={40}
                height={40}
                className="rounded-full object-cover"
              />
            )}
            <span className="font-bold text-lg">{restaurant.name}</span>
          </Link>
          <Link
            href={`/r/${slug}/order`}
            className="px-5 py-2.5 rounded-full bg-brand text-white font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Order Now
          </Link>
        </div>
      </nav>

      {/* Sections — each section (e.g. About block titles) carries its own heading;
          the page name is no longer duplicated as a standalone <h1> here. */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8">
        {pageSections.length > 0 ? (
          <SectionRenderer sections={pageSections} restaurant={restaurant} />
        ) : (
          <p className="py-16 text-center text-[var(--text-soft)]">
            Cette page n&apos;a pas encore de contenu.
          </p>
        )}
      </div>

      {/* Site-wide footer */}
      <div className="mt-16">
        <SiteFooter restaurant={restaurant} sectionsOverride={overrideSections ?? undefined} />
      </div>
    </div>
  );
}
