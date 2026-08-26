import { CateringExperience } from "@/components/CateringExperience";
import { PageAppearanceScope } from "@/components/PageAppearanceScope";
import type { Restaurant } from "@/lib/types";
import {
  filterBySelectedIds,
  type WebsiteV3Page,
} from "@/lib/websiteV3Api";
import type {
  CateringCatalogItemPublic,
  CateringCatalogPublic,
  CateringServicePublic,
} from "@/services/api";
import { canonicalPagePresentation } from "@/lib/websiteV3Rendering";

type CateringWebsitePage = Extract<WebsiteV3Page, { type: "catering" }>;

/** Renders prepared catering services through the canonical page chrome. */
export function CateringPageView({
  restaurant,
  page,
  services,
  initialSelection,
  previewMode = false,
}: {
  restaurant: Restaurant;
  page: CateringWebsitePage;
  services: CateringServicePublic[];
  initialSelection?: {
    service: CateringServicePublic;
    catalog: CateringCatalogPublic;
    item?: CateringCatalogItemPublic;
  } | null;
  previewMode?: boolean;
}) {
  const shown = filterBySelectedIds(services, page.settings.service_ids);
  const presentation = canonicalPagePresentation(page);

  return (
    <PageAppearanceScope appearance={page.appearance_overrides}>
      <CateringExperience
        restaurant={restaurant}
        services={shown}
        pageSlug={presentation.pageSlug}
        pageSections={presentation.pageSections}
        showFooter={presentation.showFooter}
        initialSelection={initialSelection}
        previewMode={previewMode}
      />
    </PageAppearanceScope>
  );
}
