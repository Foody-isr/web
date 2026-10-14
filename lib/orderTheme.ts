import { fetchRestaurant } from "@/services/api";
import { fetchDefaultWebsitePage, fetchWebsitePage, type WebsiteV3Page } from "./websiteV3Api";
import type { Restaurant } from "./types";

export type OrderThemeSeed = {
  restaurantId: string;
  pageSlug: string;
  restaurant: Restaurant;
  page: WebsiteV3Page | null;
};

/** Resolve the published page used by every presentation of the order journey. */
export async function fetchOrderThemePage(restaurantId: string, pageSlug: string): Promise<WebsiteV3Page | null> {
  const exact = pageSlug ? await fetchWebsitePage(restaurantId, pageSlug) : null;
  return exact ?? fetchDefaultWebsitePage(restaurantId, "order");
}

/** Load only public visual context before rendering cart, checkout or order status. */
export async function fetchOrderThemeSeed(restaurantId: string, pageSlug: string): Promise<OrderThemeSeed> {
  const [restaurant, page] = await Promise.all([fetchRestaurant(restaurantId), fetchOrderThemePage(restaurantId, pageSlug)]);
  return { restaurantId, pageSlug, restaurant, page };
}
