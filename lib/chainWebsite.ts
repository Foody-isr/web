import type { Restaurant } from "@/lib/types";

/** True when the restaurant is a local branch of a published chain website. */
export function isLocalChainWebsite(restaurant: Restaurant): boolean {
  return restaurant.chainPrimaryRestaurantId != null &&
    restaurant.chainPrimaryRestaurantId !== restaurant.id;
}

/** Applies brand-owned website presentation without replacing local commerce
 * identity. Menus, fulfillment, contact details and the URL remain local. */
export function inheritChainWebsitePresentation(
  local: Restaurant,
  brand: Restaurant,
): Restaurant {
  return {
    ...local,
    logoUrl: local.logoUrl || brand.logoUrl,
    coverUrl: local.coverUrl || brand.coverUrl,
    backgroundColor: brand.backgroundColor,
    websiteConfig: brand.websiteConfig,
    websiteSections: brand.websiteSections,
  };
}
