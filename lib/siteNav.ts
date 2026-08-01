import { Restaurant } from "@/lib/types";

export type SiteNavItem = { key: string; label: string; href: string };

/**
 * Ordered nav items for the horizontal top nav / drawer, built from the
 * restaurant's builder config. Landing uses the restaurant root, default
 * commerce pages use canonical aliases, and every other page uses its slug.
 */
export function buildNavPageItems(restaurant: Restaurant): SiteNavItem[] {
  const slug = restaurant.slug || String(restaurant.id);
  return (restaurant.websiteConfig?.pages ?? [])
    .filter((p) => p.showInNav !== false)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((page) => {
      if (page.pageType === "landing") {
        return { key: "home", label: page.label, href: `/r/${slug}` };
      }
      if (page.pageType === "order" && page.isDefault) {
        return { key: "menu", label: page.label, href: `/r/${slug}/order` };
      }
      if (page.pageType === "catering" && page.isDefault) {
        return {
          key: "catering",
          label: page.label,
          href: `/r/${slug}/catering`,
        };
      }
      return {
        key: page.slug,
        label: page.label,
        href: `/r/${slug}/${page.slug}`,
      };
    });
}
