import type { Restaurant } from "@/lib/types";
import { buildNavPageItems, type SiteNavItem } from "@/lib/siteNav";

export type SystemNavLabels = {
  stories: string;
  orders: string;
  home?: string;
  menu?: string;
  catering?: string;
};

export type ActiveNavigationSelection =
  | { kind: "page"; key: string }
  | { kind: "system"; key: "stories" | "orders" }
  | { kind: "landing-alias" }
  | { kind: "order-alias" }
  | { kind: "catering-alias" };

/** Reports whether every server-side prerequisite for Stories is satisfied. */
export function canNavigateToStories(restaurant: Restaurant): boolean {
  return restaurant.storiesNavigationAvailable === true;
}

/**
 * Builds the public drawer navigation. Published V3 pages are the only
 * page-backed entries; Stories and Orders are explicit system destinations.
 */
export function buildSystemNavItems(
  restaurant: Restaurant,
  labels: SystemNavLabels,
): SiteNavItem[] {
  const slug = restaurant.slug || String(restaurant.id);
  const items = buildNavPageItems(restaurant, labels);

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

  return items;
}

/** Chooses the drawer interaction without changing shared link eligibility. */
export function navigationInteractionForItem(
  item: Pick<SiteNavItem, "key">,
  hasCartAwareReorder: boolean,
): "link" | "orders-sheet" {
  return item.key === "orders" && hasCartAwareReorder
    ? "orders-sheet"
    : "link";
}

/** Marks the item selected by an explicit page, system, or legacy route intent. */
export function withActiveNavigationItem(
  items: SiteNavItem[],
  active: ActiveNavigationSelection | null | undefined,
): Array<SiteNavItem & { isActive: boolean }> {
  return items.map((item) => ({
    ...item,
    isActive: isNavigationItemActive(item, active),
  }));
}

function isNavigationItemActive(
  item: SiteNavItem,
  active: ActiveNavigationSelection | null | undefined,
): boolean {
  if (!active) return false;
  switch (active.kind) {
    case "page":
    case "system":
      return item.key === active.key;
    case "landing-alias":
      return item.orderKey === "home";
    case "order-alias":
      return item.orderKey === "menu";
    case "catering-alias":
      return item.orderKey === "catering";
  }
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
