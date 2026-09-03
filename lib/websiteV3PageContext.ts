import { cache } from "react";
import { fetchRestaurant } from "@/services/api";
import { fetchWebsitePages } from "./websiteV3Api";
import { resolveHomepagePage } from "./websiteV3Rendering";
import {
  inheritChainWebsitePresentation,
  isLocalChainWebsite,
} from "./chainWebsite";

/** Resolves the public website owner without copying builder state. A local
 * branch keeps its operational identity while inheriting the primary
 * restaurant's published Website V3 configuration and pages. */
export const getWebsiteV3SiteContext = cache(async (
  restaurantId: string,
  includeUnactivated = false,
) => {
  const localRestaurant = await fetchRestaurant(restaurantId);
  const primaryID = localRestaurant.chainPrimaryRestaurantId;
  const isLocalBranch = isLocalChainWebsite(localRestaurant);

  if (!isLocalBranch) {
    const pages = await fetchWebsitePages(restaurantId, includeUnactivated);
    return {
      restaurant: localRestaurant,
      brandRestaurant: localRestaurant,
      pages,
      isLocalBranch: false,
    };
  }

  const [brandRestaurant, pages] = await Promise.all([
    fetchRestaurant(String(primaryID)),
    fetchWebsitePages(String(primaryID), includeUnactivated),
  ]);
  return {
    restaurant: inheritChainWebsitePresentation(localRestaurant, brandRestaurant),
    brandRestaurant,
    pages,
    isLocalBranch: true,
  };
});

/** Loads the canonical Website V3 landing context once per server request. */
export const getWebsiteV3LandingContext = cache(async (
  restaurantId: string,
  includeUnactivated = false,
) => {
  const context = await getWebsiteV3SiteContext(restaurantId, includeUnactivated);
  return { ...context, page: resolveHomepagePage(context.pages) };
});

/** Loads one canonical Website V3 page context once per server request. */
export const getWebsiteV3PageContext = cache(
  async (
    restaurantId: string,
    pageSlug: string,
    includeUnactivated = false,
  ) => {
    const context = await getWebsiteV3SiteContext(restaurantId, includeUnactivated);
    return {
      ...context,
      page: context.pages.find((candidate) => candidate.slug === pageSlug) ?? null,
    };
  },
);
