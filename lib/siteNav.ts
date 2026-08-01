import { Restaurant, type WebsitePage } from "@/lib/types";

export type SiteNavItem = {
  key: string;
  label: string;
  href: string;
  pageType?: WebsitePage["pageType"];
  orderKey?: string;
};

/**
 * Ordered nav items for the horizontal top nav / drawer, built from the
 * restaurant's builder config. Landing uses the restaurant root, default
 * commerce pages use canonical aliases, and every other page uses its slug.
 */
export function buildNavPageItems(restaurant: Restaurant): SiteNavItem[] {
  const slug = restaurant.slug || String(restaurant.id);
  const cateringEnabled = restaurant.cateringEnabled === true;
  const effectiveCateringOnly =
    cateringEnabled && restaurant.cateringOnly === true;
  return (restaurant.websiteConfig?.pages ?? [])
    .filter(
      (page) =>
        page.showInNav !== false &&
        pageIsAvailable(
          page,
          restaurant.websiteConfig?.landingEnabled !== false,
          cateringEnabled,
          effectiveCateringOnly,
        ),
    )
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((page) => {
      if (page.pageType === "landing") {
        return {
          key: page.slug,
          label: page.label,
          href: `/r/${slug}`,
          pageType: page.pageType,
          orderKey: "home",
        };
      }
      if (page.pageType === "order" && page.isDefault) {
        return {
          key: page.slug,
          label: page.label,
          href: `/r/${slug}/order`,
          pageType: page.pageType,
          orderKey: "menu",
        };
      }
      if (page.pageType === "catering" && page.isDefault) {
        return {
          key: page.slug,
          label: page.label,
          href: `/r/${slug}/catering`,
          pageType: page.pageType,
          orderKey: "catering",
        };
      }
      return {
        key: page.slug,
        label: page.label,
        href: `/r/${slug}/${page.slug}`,
        pageType: page.pageType,
      };
    });
}

function pageIsAvailable(
  page: WebsitePage,
  landingEnabled: boolean,
  cateringEnabled: boolean,
  effectiveCateringOnly: boolean,
): boolean {
  if (page.pageType === "landing") return landingEnabled;
  if (page.pageType === "order") return !effectiveCateringOnly;
  if (page.pageType === "catering") return cateringEnabled;
  return true;
}
