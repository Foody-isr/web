import { Restaurant } from "@/lib/types";

export type SiteNavItem = { key: string; label: string; href: string };

/**
 * Ordered nav items for the horizontal top nav / drawer, built from the
 * restaurant's builder config: custom pages that opted into the nav
 * (`showInNav !== false`), then the catering shop when catering is enabled.
 * The classic order page is offered separately as the primary CTA (see
 * SiteNavbar), so it is not included here.
 */
export function buildNavPageItems(restaurant: Restaurant, cateringLabel: string): SiteNavItem[] {
  const slug = restaurant.slug || String(restaurant.id);
  const items: SiteNavItem[] = (restaurant.websiteConfig?.pages ?? [])
    .filter((p) => p.showInNav !== false)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((p) => ({ key: p.slug, label: p.label, href: `/r/${slug}/${p.slug}` }));

  if (restaurant.cateringEnabled) {
    items.push({ key: "catering", label: cateringLabel, href: `/r/${slug}/catering` });
  }
  return items;
}
