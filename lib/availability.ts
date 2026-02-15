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
 * Check if a restaurant is currently open for a specific service type
 */
export function checkAvailability(
  openingHours: OpeningHoursConfig | undefined,
  serviceType: OrderType,
  timezone: string = "UTC"
): AvailabilityStatus {
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
  timezone: string = "UTC"
): string {
  const status = checkAvailability(openingHours, serviceType, timezone);

  if (status.isOpen) {
    return "Open now";
  }

  return status.message || "Closed";
}
