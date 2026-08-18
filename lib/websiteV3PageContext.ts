import { cache } from "react";
import { fetchRestaurant } from "@/services/api";
import { fetchWebsitePages } from "./websiteV3Api";
import { resolveHomepagePage } from "./websiteV3Rendering";

/** Loads the canonical Website V3 landing context once per server request. */
export const getWebsiteV3LandingContext = cache(async (restaurantId: string) => {
  const [restaurant, pages] = await Promise.all([
    fetchRestaurant(restaurantId),
    fetchWebsitePages(restaurantId),
  ]);
  return { restaurant, page: resolveHomepagePage(pages), pages };
});

/** Loads one canonical Website V3 page context once per server request. */
export const getWebsiteV3PageContext = cache(
  async (restaurantId: string, pageSlug: string) => {
    const [restaurant, pages] = await Promise.all([
      fetchRestaurant(restaurantId),
      fetchWebsitePages(restaurantId),
    ]);
    return {
      restaurant,
      page: pages.find((candidate) => candidate.slug === pageSlug) ?? null,
      pages,
    };
  },
);
