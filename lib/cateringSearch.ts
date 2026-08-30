import type { CateringCatalogItemPublic, CateringFlowConfigPublic, CateringServicePublic } from "@/services/api";

/** Builds the universal two-question search used when an offer group has no
 * custom journey. Each entry is rendered as one screen by the flow wizard. */
export function defaultCateringSearchFlow(t: (key: string) => string): CateringFlowConfigPublic {
  return {
    version: 3,
    enabled: true,
    steps: [
      {
        id: "search_guests",
        kind: "guest_count",
        scope: "booking",
        title: t("catering_search_guests_title"),
        description: t("catering_search_guests_hint"),
        required: true,
      },
      {
        id: "search_dates",
        kind: "schedule",
        scope: "booking",
        title: t("catering_search_dates_title"),
        description: t("catering_search_dates_hint"),
        required: true,
        schedule: { mode: "custom", min_sessions: 1, max_sessions: 7, allow_same_day: false, date_only: true },
      },
    ],
  };
}

function dateWeekday(date: string | undefined): number | null {
  if (!date) return null;
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getDay();
}

/** Matches the same guest/day constraints enforced by the quote API. */
export function offerMatchesCateringSearch(
  item: CateringCatalogItemPublic,
  guests: number,
  date: string | undefined,
  pricingModel: CateringServicePublic["pricingModel"],
): boolean {
  if (pricingModel === "per_person" && item.minGuests > 0 && guests < item.minGuests) return false;
  const weekday = dateWeekday(date);
  return item.availableWeekdays.length === 0 || weekday === null || item.availableWeekdays.includes(weekday);
}
