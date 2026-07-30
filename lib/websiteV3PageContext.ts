import { cache } from "react";
import { fetchRestaurant } from "@/services/api";
import { fetchWebsitePage, fetchWebsitePages } from "./websiteV3Api";
import { selectLandingPage } from "./websiteV3Rendering";

/** Loads the canonical Website V3 landing context once per server request. */
export const getWebsiteV3LandingContext = cache(async (restaurantId: string) => {
  const [restaurant, pages] = await Promise.all([
    fetchRestaurant(restaurantId),
    fetchWebsitePages(restaurantId),
  ]);
  return { restaurant, page: selectLandingPage(pages) };
});

/** Loads one canonical Website V3 page context once per server request. */
export const getWebsiteV3PageContext = cache(
  async (restaurantId: string, pageSlug: string) => {
    const [restaurant, page] = await Promise.all([
      fetchRestaurant(restaurantId),
      fetchWebsitePage(restaurantId, pageSlug),
    ]);
    return { restaurant, page };
  },
);
