import {
  OpeningHoursConfig,
  OrderType,
  DaySchedule,
  ServiceTypeSchedule,
} from "./types";

export const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export type DayKey = (typeof DAY_KEYS)[number];

/**
 * Last-resort timezone when a restaurant payload carries none.
 *
 * The API resolves and returns the effective timezone, so this should never be
 * reached in practice. It is deliberately NOT "UTC": every restaurant on the
 * platform is in Israel, and defaulting to UTC silently shifted every hours
 * comparison by the local offset, showing open restaurants as closed all
 * morning.
 */
export const PLATFORM_TIMEZONE = "Asia/Jerusalem";

/** The fields any availability decision needs from a restaurant. */
export interface AvailabilityRestaurant {
  openingHoursConfig?: OpeningHoursConfig;
  timezone?: string;
  batchFulfillmentEnabled?: boolean;
}

/**
 * Why a restaurant is unavailable, as data rather than a baked English string,
 * so each surface renders it in the customer's language.
 */
export type AvailabilityReason =
  | { kind: "service_unavailable" }
  | { kind: "closed_all_day"; weekday: DayKey }
  /** `time` is the opening time as stored, "HH:MM" on a 24-hour clock. */
  | { kind: "opens_at"; time: string };

export interface AvailabilityStatus {
  isOpen: boolean;
  reason?: AvailabilityReason;
  /** Today's closing time ("HH:MM") while open, for "Open · 22:00" chips. */
  closesAt?: string;
}

/** The timezone a restaurant's hours must be read in. */
export function restaurantTimezone(restaurant: AvailabilityRestaurant): string {
  return restaurant.timezone?.trim() || PLATFORM_TIMEZONE;
}

/** Local wall-clock parts at the restaurant, not in the visitor's timezone. */
function localNow(restaurant: AvailabilityRestaurant): {
  weekday: DayKey;
  time: string;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: restaurantTimezone(restaurant),
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "long",
  }).formatToParts(new Date());

  const weekday = parts
    .find((p) => p.type === "weekday")
    ?.value.toLowerCase() as DayKey | undefined;
  // Intl emits "24" for midnight under hour12: false in some engines.
  const hour = (parts.find((p) => p.type === "hour")?.value ?? "00").replace(
    "24",
    "00"
  );
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";

  return {
    weekday: weekday && DAY_KEYS.includes(weekday) ? weekday : "monday",
    time: `${hour}:${minute}`,
  };
}

/** Today's weekday at the restaurant, for highlighting an opening-hours list. */
export function restaurantWeekday(restaurant: AvailabilityRestaurant): DayKey {
  return localNow(restaurant).weekday;
}

/**
 * Whether a restaurant is open right now for a service type.
 *
 * This is the single answer every surface must render: the storefront banner,
 * the hero status chip and the opening-hours panel all call it, so they cannot
 * disagree with each other or with the server. It resolves the restaurant's
 * timezone itself precisely so no caller can forget to pass one.
 *
 * When `batchFulfillmentEnabled` is true, pickup and delivery are always open
 * at this layer: orders are accepted continuously until the weekly cutoff and
 * fulfilled on the configured batch day, and the cutoff itself is enforced at
 * checkout via the batch-fulfillment-config endpoint (`orderingOpen`). Dine-in
 * still respects regular opening hours.
 */
export function checkRestaurantAvailability(
  restaurant: AvailabilityRestaurant,
  serviceType: OrderType
): AvailabilityStatus {
  if (
    restaurant.batchFulfillmentEnabled &&
    (serviceType === "pickup" || serviceType === "delivery")
  ) {
    return { isOpen: true };
  }

  // No configured hours means always open (fallback).
  if (!restaurant.openingHoursConfig) {
    return { isOpen: true };
  }

  const schedule = scheduleForServiceType(
    restaurant.openingHoursConfig,
    serviceType
  );
  if (!schedule) {
    return { isOpen: false, reason: { kind: "service_unavailable" } };
  }

  const { weekday, time } = localNow(restaurant);
  const daySchedule: DaySchedule = schedule[weekday];

  if (!daySchedule || daySchedule.closed) {
    return { isOpen: false, reason: { kind: "closed_all_day", weekday } };
  }

  if (isTimeInRange(time, daySchedule.open, daySchedule.close)) {
    return { isOpen: true, closesAt: daySchedule.close };
  }

  return {
    isOpen: false,
    reason: { kind: "opens_at", time: daySchedule.open },
  };
}

const DAY_LABEL_KEYS: Record<DayKey, string> = {
  sunday: "daySunday",
  monday: "dayMonday",
  tuesday: "dayTuesday",
  wednesday: "dayWednesday",
  thursday: "dayThursday",
  friday: "dayFriday",
  saturday: "daySaturday",
};

/**
 * Renders an unavailability reason in the customer's language.
 *
 * Kept here next to the reason type so every surface phrases it identically;
 * `t` is passed in rather than imported to keep this module free of React.
 */
export function availabilityReasonText(
  reason: AvailabilityReason | undefined,
  serviceLabel: string,
  t: (key: string) => string
): string | null {
  if (!reason) return null;
  switch (reason.kind) {
    case "service_unavailable":
      return t("serviceUnavailable").replace("{service}", serviceLabel);
    case "closed_all_day":
      return t("closedAllDay").replace(
        "{day}",
        t(DAY_LABEL_KEYS[reason.weekday])
      );
    case "opens_at":
      return t("closedOpensAt").replace("{time}", reason.time);
    default:
      return null;
  }
}

function scheduleForServiceType(
  config: OpeningHoursConfig,
  serviceType: OrderType
): ServiceTypeSchedule | null {
  switch (serviceType) {
    case "dine_in":
      return config.dine_in;
    case "pickup":
      return config.pickup;
    case "delivery":
      return config.delivery;
    default:
      return null;
  }
}

function isTimeInRange(current: string, open: string, close: string): boolean {
  // Same open and close time means open all day (e.g., 00:00 - 00:00)
  if (open === close) {
    return true;
  }
  // Overnight hours (e.g., 22:00 - 02:00)
  if (close < open) {
    return current >= open || current < close;
  }
  return current >= open && current < close;
}
