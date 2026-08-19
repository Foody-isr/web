import {
  OpeningHoursConfig,
  OrderType,
  DaySchedule,
  ServiceTypeSchedule,
} from "./types";

export interface AvailabilityStatus {
  isOpen: boolean;
  message?: string;
  nextOpening?: Date;
}

/**
 * Check if a restaurant is currently open for a specific service type.
 *
 * When `batchFulfillmentEnabled` is true, pickup and delivery are always
 * considered open at this layer — orders are accepted continuously until the
 * weekly cutoff and fulfilled on the configured batch day. The cutoff itself
 * is enforced at checkout via the batch-fulfillment-config endpoint
 * (`orderingOpen`). Dine-in still respects regular opening hours.
 */
export function checkAvailability(
  openingHours: OpeningHoursConfig | undefined,
  serviceType: OrderType,
  timezone: string = "UTC",
  batchFulfillmentEnabled: boolean = false
): AvailabilityStatus {
  if (
    batchFulfillmentEnabled &&
    (serviceType === "pickup" || serviceType === "delivery")
  ) {
    return { isOpen: true };
  }

  if (!openingHours) {
    // No config means always open (fallback)
    return { isOpen: true };
  }

  const schedule = getScheduleForServiceType(openingHours, serviceType);
  if (!schedule) {
    return {
      isOpen: false,
      message: `${capitalizeServiceType(serviceType)} is not available`,
    };
  }

  // Get current time in restaurant's timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "long",
  });

  const parts = formatter.formatToParts(now);
  const weekday =
    parts.find((p) => p.type === "weekday")?.value.toLowerCase() || "monday";
  const hour = parts.find((p) => p.type === "hour")?.value || "00";
  const minute = parts.find((p) => p.type === "minute")?.value || "00";
  const currentTime = `${hour}:${minute}`;

  const daySchedule = getDaySchedule(schedule, weekday);

  if (daySchedule.closed) {
    return {
      isOpen: false,
      message: `Closed on ${capitalizeFirst(weekday)}s`,
    };
  }

  // Check if current time is within operating hours
  const isOpen = isTimeInRange(
    currentTime,
    daySchedule.open,
    daySchedule.close
  );

  if (isOpen) {
    return { isOpen: true };
  } else {
    return {
      isOpen: false,
      message: `Opens at ${formatTime(daySchedule.open)}`,
    };
  }
}

function getScheduleForServiceType(
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

function getDaySchedule(
  schedule: ServiceTypeSchedule,
  weekday: string
): DaySchedule {
  const key = weekday.toLowerCase() as keyof ServiceTypeSchedule;
  return schedule[key];
}

function isTimeInRange(
  current: string,
  open: string,
  close: string
): boolean {
  // Same open and close time means open all day (e.g., 00:00 - 00:00)
  if (open === close) {
    return true;
  }
  // Handle overnight hours (e.g., 22:00 - 02:00)
  if (close < open) {
    // Overnight operation
    return current >= open || current < close;
  }
  // Normal same-day hours
  return current >= open && current < close;
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
}

function capitalizeServiceType(serviceType: OrderType): string {
  switch (serviceType) {
    case "dine_in":
      return "Dine-in";
    case "pickup":
      return "Pickup";
    case "delivery":
      return "Delivery";
    default:
      return serviceType;
  }
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Get a human-readable status message for a service type
 */
export function getAvailabilityMessage(
  openingHours: OpeningHoursConfig | undefined,
  serviceType: OrderType,
  timezone: string = "UTC",
  batchFulfillmentEnabled: boolean = false
): string {
  const status = checkAvailability(
    openingHours,
    serviceType,
    timezone,
    batchFulfillmentEnabled
  );

  if (status.isOpen) {
    return "Open now";
  }

  return status.message || "Closed";
}
