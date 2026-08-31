import type { WebsiteSection } from "@/lib/types";
import type { WebsiteV3Page } from "@/lib/websiteV3Api";
import {
  canonicalPagePresentation,
  resolveHomepagePage,
  visibleSectionsInRenderOrder,
} from "@/lib/websiteV3Rendering";

/**
 * Reuses the homepage's curated feature cards as discovery material on the
 * order page. The cards themselves remain owned by the homepage editor, so a
 * newly published service can surface in both places without duplicate setup.
 */
export function orderDiscoverySections(
  pages: WebsiteV3Page[],
): WebsiteSection[] {
  const homepage = resolveHomepagePage(pages);
  const sourcePage =
    (homepage && hasFeatureCards(homepage) ? homepage : undefined) ??
    pages.find((page) => page.type === "landing" && hasFeatureCards(page));
  if (!sourcePage) return [];

  return visibleSectionsInRenderOrder(
    canonicalPagePresentation(sourcePage).pageSections,
  ).filter((section) => section.sectionType === "feature_cards");
}

function hasFeatureCards(page: WebsiteV3Page): boolean {
  return page.sections.some(
    (section) => section.is_visible && section.section_type === "feature_cards",
  );
}

/** Returns true for cards that point back to the order experience itself. */
export function isOrderDiscoveryLink(
  link: string | undefined,
  orderPageSlug: string,
): boolean {
  if (!link || /^(?:https?:)?\/\//i.test(link) || link.startsWith("#")) {
    return false;
  }

  const path = link
    .split(/[?#]/, 1)[0]
    .replace(/^\/+|\/+$/g, "");
  let normalizedPath = path;
  try {
    normalizedPath = decodeURIComponent(path);
  } catch {
    // A malformed escape is still safe to compare as its literal path.
  }

  return normalizedPath === "order" || normalizedPath === orderPageSlug;
}

/** Resolves a feature-card target inside the restaurant's public website. */
export function resolveRestaurantCardHref(
  link: string | undefined,
  restaurantSlug: string,
): string | null {
  const target = link?.trim();
  if (!target) return null;
  if (
    target.startsWith("http://") ||
    target.startsWith("https://") ||
    target.startsWith("#")
  ) {
    return target;
  }

  const path = target.startsWith("/") ? target : `/${target}`;
  return `/r/${encodeURIComponent(restaurantSlug)}${path}`;
}
