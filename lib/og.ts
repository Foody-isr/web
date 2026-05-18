import type { Restaurant } from "./types";

export function buildRestaurantOgImageUrl(
  restaurant: Restaurant,
  appUrl: string
): string {
  const url = new URL("/api/og", appUrl);
  url.searchParams.set("name", restaurant.name);
  if (restaurant.logoUrl) {
    url.searchParams.set("logo", restaurant.logoUrl);
  } else if (restaurant.coverUrl) {
    url.searchParams.set("cover", restaurant.coverUrl);
    if (restaurant.coverFocalX != null) {
      url.searchParams.set("fx", String(restaurant.coverFocalX));
    }
    if (restaurant.coverFocalY != null) {
      url.searchParams.set("fy", String(restaurant.coverFocalY));
    }
  } else if (restaurant.backgroundColor) {
    url.searchParams.set("bg", restaurant.backgroundColor);
  }
  return url.toString();
}
