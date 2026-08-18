import { SectionRenderer } from "@/components/sections/SectionRenderer";
import { SiteFooter } from "@/components/SiteFooter";
import { PoweredByFoody } from "@/components/PoweredByFoody";
import { SiteNavbar } from "@/components/SiteNavbar";
import { PageAppearanceScope } from "@/components/PageAppearanceScope";
import type { Restaurant } from "@/lib/types";
import type { WebsiteV3Page } from "@/lib/websiteV3Api";
import type { ChainOrderEntry } from "@/services/api";
import { ChainBranchDirectory } from "@/components/ChainBranchDirectory";
import {
  canonicalPagePresentation,
  hasLeadingVisibleHero,
  visibleSectionsInRenderOrder,
} from "@/lib/websiteV3Rendering";

type ContentWebsitePage = Extract<WebsiteV3Page, { type: "landing" | "content" }>;

/** Renders a published landing or content page from its canonical V3 sections. */
export function ContentPage({
  restaurant,
  page,
  chainEntry,
}: {
  restaurant: Restaurant;
  page: ContentWebsitePage;
  chainEntry?: ChainOrderEntry | null;
}) {
  const presentation = canonicalPagePresentation(page);
  const visibleSections = visibleSectionsInRenderOrder(
    presentation.pageSections,
  );

  return (
    <PageAppearanceScope appearance={presentation.appearance}>
      <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text)]">
        <SiteNavbar
          restaurant={restaurant}
          activeKey={presentation.pageSlug}
          pageType="content"
          overHero={hasLeadingVisibleHero(presentation.pageSections)}
        />
        {visibleSections.length > 0 ? (
          <SectionRenderer
            sections={visibleSections}
            restaurant={restaurant}
          />
        ) : (
          !chainEntry && <p className="py-16 text-center text-[var(--text-soft)]">Cette page n&apos;a pas encore de contenu.</p>
        )}
        {chainEntry ? <ChainBranchDirectory entry={chainEntry} /> : null}
        {presentation.showFooter ? (
          <SiteFooter
            restaurant={restaurant}
            sectionsOverride={presentation.pageSections.some(
              (section) => section.sectionType === "footer",
            )
              ? presentation.pageSections
              : undefined}
          />
        ) : null}
        <PoweredByFoody restaurantSlug={restaurant.slug} />
      </div>
    </PageAppearanceScope>
  );
}
