/** Builds a direct branch order URL. The primary branch gets an explicit
 * bypass marker because its bare /order route is the global branch selector. */
export function buildChainBranchOrderHref(input: {
  slug: string;
  restaurantId: number;
  primaryRestaurantId?: number;
  orderType: "pickup" | "delivery";
  locale: "en" | "fr" | "he";
}): string {
  const query = new URLSearchParams({ type: input.orderType, lang: input.locale });
  if (input.primaryRestaurantId === input.restaurantId) {
    query.set("branch_id", String(input.restaurantId));
  }
  return `/r/${encodeURIComponent(input.slug)}/order?${query.toString()}`;
}
