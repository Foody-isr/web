import { SectionRenderer } from "@/components/sections/SectionRenderer";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNavbar } from "@/components/SiteNavbar";
import { PageAppearanceScope } from "@/components/PageAppearanceScope";
import type { Restaurant } from "@/lib/types";
import type { WebsiteV3Page } from "@/lib/websiteV3Api";
import {
  canonicalPagePresentation,
  visibleSectionsInRenderOrder,
} from "@/lib/websiteV3Rendering";

type ContentWebsitePage = Extract<WebsiteV3Page, { type: "landing" | "content" }>;

/** Renders a published landing or content page from its canonical V3 sections. */
export function ContentPage({
  restaurant,
  page,
}: {
  restaurant: Restaurant;
  page: ContentWebsitePage;
}) {
  const presentation = canonicalPagePresentation(page);
  const visibleSections = visibleSectionsInRenderOrder(
    presentation.pageSections,
  );
  const firstVisibleSection = visibleSections[0];

  return (
    <PageAppearanceScope appearance={presentation.appearance}>
      <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text)]">
        <SiteNavbar
          restaurant={restaurant}
          activeKey={presentation.pageSlug}
          pageType="content"
          overHero={firstVisibleSection?.sectionType === "hero_banner"}
        />
        {visibleSections.length > 0 ? (
          <SectionRenderer
            sections={visibleSections}
            restaurant={restaurant}
          />
        ) : (
          <p className="py-16 text-center text-[var(--text-soft)]">
            Cette page n&apos;a pas encore de contenu.
          </p>
        )}
        <SiteFooter restaurant={restaurant} />
      </div>
    </PageAppearanceScope>
  );
}
