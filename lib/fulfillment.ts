import type { MenuItem, Restaurant, SchedulingTimeSlot } from "@/lib/types";

/** The `t` returned by useI18n. Kept structural so pure helpers stay testable. */
type TFn = (key: string) => string;

type LeadRestaurant = Pick<Restaurant, "schedulingLeadTimeMinutes" | "schedulingMinDaysAhead">;
type LeadItem = Pick<MenuItem, "preparationLeadTimeMinutes">;

/** Two calendar days, in minutes. Above this a promise reads better in days. */
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

/**
 * The notice the cart as a whole owes, and the line that imposes it.
 *
 * The slowest line wins, exactly as orders.resolveCartFulfillment decides it
 * server-side.
 *
 * Deliberately approximate in one case: a combo's components are carried as
 * bare ids, so only the combo's own promise is read here. A combo containing a
 * slower component under-reports. That is safe because this drives a preview,
 * never a decision — checkout re-asks the server (which does expand combos, via
 * fulfillmentItemsFromCart) and shows the real date before anyone pays.
 */
export function cartLeadMinutes(
  lines: Array<{ item: LeadItem }>,
  restaurant: LeadRestaurant | null | undefined
): { minutes: number; constrainedBy: { item: LeadItem } | null } {
  let minutes = 0;
  let constrainedBy: { item: LeadItem } | null = null;
  for (const line of lines) {
    const lead = effectiveLeadMinutes(line.item, restaurant);
    if (lead > minutes) {
      minutes = lead;
      constrainedBy = line;
    }
  }
  return { minutes, constrainedBy };
}

/**
 * Renders a duration the way a customer says it: "30 min", "48 h", "5 jours".
 *
 * Always rounds up — promising less notice than the kitchen asked for is the
 * one error this must never make.
 */
export function formatLeadDuration(minutes: number, t: TFn): string {
  const safe = Math.max(0, minutes);
  if (safe < MINUTES_PER_HOUR) {
    return t("leadTimeUnitMinutes").replace("{n}", String(Math.ceil(safe)));
  }
  if (safe < DAYS_THRESHOLD_MINUTES) {
    return t("leadTimeUnitHours").replace("{n}", String(Math.ceil(safe / MINUTES_PER_HOUR)));
  }
  // The threshold guarantees 3 or more here, so there is no singular to render.
  return t("leadTimeUnitDays").replace("{n}", String(Math.ceil(safe / MINUTES_PER_DAY)));
}

/**
 * The first date in `slotsByDate` that still has a slot late enough to absorb
 * `minutes` of preparation, or null when the booking horizon has none.
 *
 * Display only. Slot times are restaurant wall-clock and are compared here in
 * the browser's zone, so a customer browsing from another country can be off by
 * the offset; the server re-derives the real answer when the order is created.
 * Being wrong by an hour at a day's granularity is a hint that is very rarely
 * wrong, and it costs no round-trip.
 */
export function earliestDateFor(
  minutes: number,
  slotsByDate: Record<string, SchedulingTimeSlot[]> | null | undefined,
  now: Date
): string | null {
  if (!slotsByDate) return null;
  const earliest = new Date(now.getTime() + Math.max(0, minutes) * 60_000);
  for (const date of Object.keys(slotsByDate).sort()) {
    const slots = slotsByDate[date] ?? [];
    if (slots.some((slot) => slotStartsAtOrAfter(date, slot.start, earliest))) return date;
  }
  return null;
}

function slotStartsAtOrAfter(date: string, start: string, earliest: Date): boolean {
  const parsed = new Date(`${date}T${start}:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() >= earliest.getTime();
}
