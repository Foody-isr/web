import { Restaurant, type WebsitePage } from "@/lib/types";

export type SiteNavItem = {
  key: string;
  label: string;
  href: string;
  pageType?: WebsitePage["pageType"];
  orderKey?: string;
};

export type SiteNavLabels = {
  home: string;
  menu: string;
  catering: string;
};

const legacyLabels: SiteNavLabels = {
  home: "Home",
  menu: "Menu",
  catering: "Catering",
};

/**
 * Ordered nav items for the horizontal top nav / drawer, built from the
 * restaurant's builder config. Landing uses the restaurant root, default
 * commerce pages use canonical aliases, and every other page uses its slug.
 */
export function buildNavPageItems(
  restaurant: Restaurant,
  labels: Partial<SiteNavLabels> = {},
): SiteNavItem[] {
  const slug = restaurant.slug || String(restaurant.id);
  const cateringEnabled = restaurant.cateringEnabled === true;
  const effectiveCateringOnly =
    cateringEnabled && restaurant.cateringOnly === true;
  const pages = restaurant.websiteConfig?.pages ?? [];
  const resolvedLabels = { ...legacyLabels, ...labels };

  if (!pages.some((page) => page.pageType !== undefined)) {
    return buildLegacyNavPageItems({
      slug,
      pages,
      labels: resolvedLabels,
      landingEnabled: restaurant.websiteConfig?.landingEnabled !== false,
      cateringEnabled,
      effectiveCateringOnly,
    });
  }

  return pages
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

function buildLegacyNavPageItems({
  slug,
  pages,
  labels,
  landingEnabled,
  cateringEnabled,
  effectiveCateringOnly,
}: {
  slug: string;
  pages: WebsitePage[];
  labels: SiteNavLabels;
  landingEnabled: boolean;
  cateringEnabled: boolean;
  effectiveCateringOnly: boolean;
}): SiteNavItem[] {
  const builtIns: SiteNavItem[] = [];
  if (landingEnabled) {
    builtIns.push({
      key: "home",
      label: labels.home,
      href: `/r/${slug}`,
      pageType: "landing",
      orderKey: "home",
    });
  }
  if (!effectiveCateringOnly) {
    builtIns.push({
      key: "menu",
      label: labels.menu,
      href: `/r/${slug}/order`,
      pageType: "order",
      orderKey: "menu",
    });
  }
  if (cateringEnabled) {
    builtIns.push({
      key: "catering",
      label: labels.catering,
      href: `/r/${slug}/catering`,
      pageType: "catering",
      orderKey: "catering",
    });
  }

  const customPages = pages
    .filter((page) => page.showInNav !== false)
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((page) => ({
      key: page.slug,
      label: page.label,
      href: `/r/${slug}/${page.slug}`,
      pageType: page.pageType,
    }));
  return [...builtIns, ...customPages];
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
