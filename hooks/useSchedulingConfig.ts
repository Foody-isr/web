"use client";

import { useQuery } from "@tanstack/react-query";
import type { FulfillmentCartItem, OrderType, Restaurant } from "@/lib/types";
import { fetchSchedulingConfig } from "@/services/api";

/** Resolves cart-specific slots using the server's date range and timezone. */
export function useSchedulingConfig(restaurant: Restaurant, orderType: OrderType, items: FulfillmentCartItem[], enabled: boolean) {
  const cartKey = items.map(item => `${item.itemId}:${item.quantity}`).sort().join(",");
  return useQuery({
    queryKey: ["fulfillment-slots", restaurant.id, orderType, cartKey, restaurant.schedulingMaxDaysAhead, restaurant.schedulingLeadTimeMinutes, restaurant.schedulingPreparationTimeBasis, restaurant.schedulingPreparationStartTime, restaurant.schedulingPreparationSplittable],
    // Empty hints let the API choose its own local today and booking horizon.
    queryFn: () => fetchSchedulingConfig(String(restaurant.id), "", "", orderType, items),
    enabled: enabled && !!restaurant.schedulingEnabled && !restaurant.batchFulfillmentEnabled,
    retry: 1,
    staleTime: 0,
  });
}
