import type { Restaurant } from "@/lib/types";
import { buildNavPageItems, type SiteNavItem } from "@/lib/siteNav";

export type SystemNavLabels = {
  stories: string;
  orders: string;
};

/** Reports whether every server-side prerequisite for Stories is satisfied. */
export function canNavigateToStories(restaurant: Restaurant): boolean {
  return restaurant.storiesNavigationAvailable === true;
}

/**
 * Builds the single public navigation list shared by the drawer and bottom bar.
 * Published V3 pages are the only page-backed entries; Stories and Orders are
 * explicit system destinations layered on top.
 */
export function buildSystemNavItems(
  restaurant: Restaurant,
  labels: SystemNavLabels,
): SiteNavItem[] {
  const slug = restaurant.slug || String(restaurant.id);
  const items = buildNavPageItems(restaurant);

  if (canNavigateToStories(restaurant)) {
    items.push({
      key: "stories",
      label: labels.stories,
      href: `/r/${slug}/stories`,
    });
  }
  if (restaurant.websiteConfig?.showOrdersLink !== false) {
    items.push({
      key: "orders",
      label: labels.orders,
      href: `/r/${slug}/orders`,
    });
  }

  return applyConfiguredOrder(uniqueByHref(items), restaurant.websiteConfig?.navOrder);
}

/** Returns the canonical commerce destination used when Stories is unavailable. */
export function systemNavigationFallback(restaurant: Restaurant): string {
  const slug = restaurant.slug || String(restaurant.id);
  const destination =
    restaurant.cateringEnabled === true && restaurant.cateringOnly === true
      ? "catering"
      : "order";
  return `/r/${slug}/${destination}`;
}

function applyConfiguredOrder(
  items: SiteNavItem[],
  navOrder: string | undefined,
): SiteNavItem[] {
  const configured = (navOrder ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
  if (configured.length === 0) return items;

  const rank = new Map<string, number>();
  configured.forEach((key) => {
    if (!rank.has(key)) rank.set(key, rank.size);
  });
  return items
    .map((item, index) => ({ item, index, rank: rank.get(item.key) }))
    .sort((left, right) => {
      if (left.rank === undefined && right.rank === undefined) {
        return left.index - right.index;
      }
      if (left.rank === undefined) return 1;
      if (right.rank === undefined) return -1;
      return left.rank - right.rank;
    })
    .map(({ item }) => item);
}

function uniqueByHref(items: SiteNavItem[]): SiteNavItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });
}
