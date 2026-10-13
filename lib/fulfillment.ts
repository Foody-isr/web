import type { MenuItem, Restaurant } from "@/lib/types";

/** The `t` returned by useI18n. Kept structural so pure helpers stay testable. */
type TFn = (key: string) => string;

type LeadRestaurant = Pick<Restaurant, "schedulingLeadTimeMinutes" | "schedulingMinDaysAhead">;
type LeadItem = Pick<MenuItem, "preparationLeadTimeMinutes">;

/** Three calendar days, in minutes. Above this a promise reads better in days. */
const DAYS_THRESHOLD_MINUTES = 72 * 60;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * 60;

/**
 * The restaurant-wide preparation promise, in minutes.
 *
 * Mirrors restaurants.DefaultSchedulingLeadMinutes: the precise setting wins,
 * the legacy day-based one is the fallback, and 0 means no promise at all.
 */
export function restaurantLeadMinutes(restaurant: LeadRestaurant | null | undefined): number {
  if (!restaurant) return 0;
  const precise = restaurant.schedulingLeadTimeMinutes ?? 0;
  if (precise > 0) return precise;
  const legacyDays = restaurant.schedulingMinDaysAhead ?? 0;
  if (legacyDays > 0) return legacyDays * MINUTES_PER_DAY;
  return 0;
}

/**
 * An item's own preparation promise, falling back to the restaurant's.
 *
 * null/undefined on the item means "inherit". An explicit 0 means "same day,
 * whatever the restaurant asks for" and must NOT be read as absent — that
 * distinction is the whole reason the server models the column as a nullable
 * int rather than defaulting it to zero.
 */
export function effectiveLeadMinutes(
  item: LeadItem | null | undefined,
  restaurant: LeadRestaurant | null | undefined
): number {
  const own = item?.preparationLeadTimeMinutes;
  if (own === null || own === undefined) return restaurantLeadMinutes(restaurant);
  return Math.max(0, own);
}

/** Resolves a display notice for the selected restaurant-local calendar day.
 * A missing weekday stays unavailable; zero never inherits the house notice. */
export function itemPreparationMinutes(item: Pick<MenuItem, "preparationLeadTimeMinutes" | "preparationSchedule">, restaurant: LeadRestaurant, date?: string | null): number | null {
  const base = effectiveLeadMinutes(item, restaurant);
  if (!item.preparationSchedule) return base;
  if (!date) return null;
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const rule = item.preparationSchedule.find(rule => rule.days.includes(weekday));
  return rule ? Math.max(0, rule.lead_time_minutes ?? base) : null;
}

/**
 * Whether this item deserves a badge on the grid.
 *
 * Only items that cost MORE than the baseline every other item already costs.
 * Badging the baseline would put an identical badge on every card, which tells
 * the customer nothing and devalues the one badge that matters.
 */
export function isSlowerThanDefault(
  item: LeadItem | null | undefined,
  restaurant: LeadRestaurant | null | undefined
): boolean {
  return effectiveLeadMinutes(item, restaurant) > restaurantLeadMinutes(restaurant);
}

/** Formats the actual preparation duration without rounding a partial hour up. */
export function formatLeadDuration(minutes: number, t: TFn): string {
  const total = Math.max(0, Math.ceil(minutes));
  const days = total >= DAYS_THRESHOLD_MINUTES ? Math.floor(total / MINUTES_PER_DAY) : 0;
  const hours = Math.floor((total - days * MINUTES_PER_DAY) / MINUTES_PER_HOUR);
  const rest = total % MINUTES_PER_HOUR;
  return [days && t("leadTimeUnitDays").replace("{n}", String(days)), hours && t("leadTimeUnitHours").replace("{n}", String(hours)), (rest || !total) && t("leadTimeUnitMinutes").replace("{n}", String(rest))].filter(Boolean).join(" ");
}
