import type { OrderType, Restaurant } from "./types";
import { hasOrderingTestAccess } from "./availability";

type FulfillmentRestaurant = Pick<Restaurant, "pickupEnabled" | "deliveryEnabled" | "schedulingEnabled" | "batchFulfillmentEnabled"> & {
  websiteConfig?: Pick<NonNullable<Restaurant["websiteConfig"]>, "checkoutConfig">;
};

/** Resolves customer choices from operational rules, independently of website appearance. */
export function websiteFulfillmentRules(restaurant: FulfillmentRestaurant, tour = false) {
  const modes = (["pickup", "delivery"] as const).filter(mode => mode === "pickup" ? restaurant.pickupEnabled : restaurant.deliveryEnabled);
  const canChooseMode = !tour && modes.length > 1;
  const canChooseLocation = !tour && (canChooseMode || restaurant.deliveryEnabled);
  const canChooseTime = !tour && !!restaurant.schedulingEnabled && !restaurant.batchFulfillmentEnabled && modes.length > 0;
  return {
    modes,
    canChooseMode,
    canChooseLocation,
    canChooseTime,
    // Weekly lots fix the calendar, not the service/address. The legacy checkout-only
    // selector applies to ordinary ordering; batches collect fulfillment on entry.
    canChooseOnMenu: (restaurant.batchFulfillmentEnabled || !restaurant.websiteConfig?.checkoutConfig?.lock_order_type) && (canChooseLocation || canChooseTime),
    fixedMode: tour ? "delivery" as const : modes.length === 1 ? modes[0] : undefined,
  };
}

/** Discards stale or unsupported website modes while preserving a dine-in table context. */
export function resolveWebsiteOrderType(restaurant: Parameters<typeof websiteFulfillmentRules>[0], requested: OrderType, tour = false): OrderType {
  const rules = websiteFulfillmentRules(restaurant, tour);
  if (tour) return "delivery";
  if (requested === "dine_in") return requested;
  return rules.fixedMode ?? (rules.modes.includes(requested) ? requested : rules.modes[0]) ?? requested;
}

/** Keeps table service and delivery tours independent from the online preorder policy. */
export function requiresPreorderCalendar(restaurant: Pick<Restaurant, "preordersOnly"> | null | undefined, orderType: OrderType, tour = false): boolean {
  return !tour && !!restaurant?.preordersOnly && (orderType === "pickup" || orderType === "delivery");
}

/** Respects the restaurant's ordering pause while leaving service/address calendar checks authoritative. */
export function websiteOrderingAvailable(restaurant: Pick<Restaurant, "pickupEnabled" | "deliveryEnabled" | "rushMode" | "ordersPaused" | "orderingTestAccessExpiresAt">): boolean {
  return (restaurant.pickupEnabled || restaurant.deliveryEnabled) &&
    (hasOrderingTestAccess(restaurant) || (!restaurant.rushMode && !restaurant.ordersPaused));
}
