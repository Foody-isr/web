import type { WebsiteSection } from "@/lib/types";
import {
  buildWebsiteAliasTarget,
  canonicalRedirectForPage,
  type WebsiteV3Page,
} from "@/lib/websiteV3Api";
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

/** Resolves whether the first rendered block places a hero behind the navbar. */
export function hasLeadingVisibleHero(
  sections: WebsiteSection[],
  nativeHeroWhenEmpty = false,
): boolean {
  const firstVisibleSection = visibleSectionsInRenderOrder(sections)[0];
  return firstVisibleSection
    ? firstVisibleSection.sectionType === "hero_banner"
    : nativeHeroWhenEmpty;
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

/** Selects the explicitly published homepage without changing commerce defaults. */
export function resolveHomepagePage(
  pages: WebsiteV3Page[],
): WebsiteV3Page | null {
  return pages.find((page) => page.is_homepage) ?? null;
}

/** Resolves the canonical public route for a selected homepage. */
export function homepagePublicPath(page: WebsiteV3Page): string | null {
  if (page.type === "landing") return null;
  return canonicalRedirectForPage(page) ?? `/${page.slug}`;
}

export type WebsiteRootHomepageDecision =
  | { kind: "render"; page: WebsiteV3Page }
  | { kind: "redirect"; target: string }
  | null;

/** Resolves the explicit homepage action before any legacy root fallback. */
export function resolveWebsiteRootHomepageDecision(
  pages: WebsiteV3Page[],
  restaurantId: string,
  searchParams: WebsitePageSearchParams,
): WebsiteRootHomepageDecision {
  const homepage = resolveHomepagePage(pages);
  if (!homepage) return null;

  const publicPath = homepagePublicPath(homepage);
  if (!publicPath) return { kind: "render", page: homepage };

  return {
    kind: "redirect",
    target: buildWebsiteAliasTarget(
      restaurantId,
      publicPath.slice(1),
      searchParams,
    ),
  };
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
