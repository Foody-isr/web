"use client";

import { Restaurant } from "@/lib/types";
import { SectionRenderer } from "@/components/sections/SectionRenderer";
import { SiteFooter } from "@/components/SiteFooter";
import { PoweredByFoody } from "@/components/PoweredByFoody";
import { SiteNavbar, useNavLayoutSide } from "@/components/SiteNavbar";
import { BottomNav } from "@/components/BottomNav";
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
  const { sections: pageSections, overrideSections } = usePageSections(restaurant, pageSlug);
  // A custom page is "shopping" when the owner flagged it; that drops the full
  // top nav for the shopping modes and can carry the mobile bottom bar.
  const pageMeta = restaurant.websiteConfig?.pages?.find((p) => p.slug === pageSlug) ?? null;
  const pageType = pageMeta?.isShopping ? "shopping" : "content";
  const side = useNavLayoutSide(pageType);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-page)] text-[var(--text)]">
      <SiteNavbar restaurant={restaurant} activeKey={pageSlug} pageType={pageType} />

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

      <PoweredByFoody restaurantSlug={restaurant.slug} />

      {side.bottom_bar && (
        <>
          <BottomNav
            restaurant={restaurant}
            active={{ kind: "page", key: pageSlug }}
          />
          <div className="md:hidden" style={{ height: "var(--bottomnav-h)" }} aria-hidden />
        </>
      )}
    </div>
  );
}
