import type { WebsiteSection } from "@/lib/types";
import type { WebsiteV3Page } from "@/lib/websiteV3Api";
import {
  applyPageFooterModeToSections,
  resolvePageFooterMode,
} from "@/lib/websiteV3Appearance";

export type WebsitePageSearchParams = Record<
  string,
  string | string[] | undefined
>;

/** Returns the exact visible, non-footer sequence rendered for page sections. */
export function visibleSectionsInRenderOrder(
  sections: WebsiteSection[],
): WebsiteSection[] {
  return sections
    .filter(
      (section) => section.isVisible && section.sectionType !== "footer",
    )
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

/** Selects the canonical landing page by type rather than by a reserved slug. */
export function selectLandingPage(
  pages: WebsiteV3Page[],
): Extract<WebsiteV3Page, { type: "landing" }> | null {
  return (
    pages.find(
      (page): page is Extract<WebsiteV3Page, { type: "landing" }> =>
        page.type === "landing",
    ) ?? null
  );
}

/** Maps one canonical page into the narrow props consumed by existing experiences. */
export function canonicalPagePresentation(page: WebsiteV3Page): {
  pageSlug: string;
  pageSections: WebsiteSection[];
  showFooter: boolean;
  appearance: WebsiteV3Page["appearance_overrides"];
} {
  const pageSections = applyPageFooterModeToSections(page.sections.map((section) => ({
    id: section.id,
    sectionType: section.section_type,
    page: page.slug,
    sortOrder: section.sort_order,
    isVisible: section.is_visible,
    layout: section.layout,
    content: section.content,
    settings: section.settings,
    translations: section.translations,
  })), page.appearance_overrides);

  return {
    pageSlug: page.slug,
    pageSections,
    showFooter: resolvePageFooterMode(page.appearance_overrides) !== "hidden",
    appearance: page.appearance_overrides,
  };
}

/** Normalizes the supported canonical order-page query values. */
export function parseOrderPageSearchParams(searchParams?: WebsitePageSearchParams): {
  orderType?: string;
  previewDate?: string;
  item?: string;
  lang?: string;
} {
  const first = (value?: string | string[]): string | undefined =>
    Array.isArray(value) ? value[0] : value;
  const previewDate = first(searchParams?.preview_date);

  return {
    orderType: first(searchParams?.type),
    previewDate:
      previewDate && /^\d{4}-\d{2}-\d{2}$/.test(previewDate)
        ? previewDate
        : undefined,
    item: first(searchParams?.item),
    lang: first(searchParams?.lang),
  };
}
