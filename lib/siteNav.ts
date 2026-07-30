import { Restaurant } from "@/lib/types";

export type SiteNavItem = { key: string; label: string; href: string };

/**
 * Ordered nav items for the horizontal top nav / drawer, built from the
 * restaurant's builder config: V3 pages that opted into the nav
 * (`showInNav !== false`), with a legacy catering fallback when no typed
 * catering page exists yet.
 */
export function buildNavPageItems(restaurant: Restaurant, cateringLabel: string): SiteNavItem[] {
  const slug = restaurant.slug || String(restaurant.id);
  const items: SiteNavItem[] = (restaurant.websiteConfig?.pages ?? [])
    .filter((p) => p.showInNav !== false)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((p) => ({ key: p.slug, label: p.label, href: `/r/${slug}/${p.slug}` }));

  const hasTypedCateringPage = (restaurant.websiteConfig?.pages ?? []).some(
    (page) => page.pageType === "catering" || page.slug === "catering",
  );
  if (restaurant.cateringEnabled && !hasTypedCateringPage) {
    items.push({ key: "catering", label: cateringLabel, href: `/r/${slug}/catering` });
  }
  return items;
}
