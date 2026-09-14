import type {
  CateringCatalogItemPublic,
  CateringCatalogPublic,
  CateringFlowConfigPublic,
  CateringServicePublic,
} from "@/services/api";

/** Resolves the backward-compatible default: unit products browse first. */
export function cateringDateIsAtCheckout(service: CateringServicePublic): boolean {
  if (service.dateSelectionTiming) return service.dateSelectionTiming === "checkout";
  return service.pricingModel === "per_unit" || service.pricingModel === "mixed";
}

/** Splits one published journey around the catalog without changing its rules. */
export function splitCateringFlowByDateTiming(
  config: CateringFlowConfigPublic,
  dateAtCheckout: boolean,
): { beforeCatalog: CateringFlowConfigPublic; checkout?: CateringFlowConfigPublic } {
  if (!dateAtCheckout) return { beforeCatalog: config };
  return {
    beforeCatalog: {
      ...config,
      steps: config.steps.filter((step) => step.kind !== "schedule" && step.scope !== "session"),
    },
    checkout: {
      ...config,
      steps: config.steps.filter((step) => step.kind === "schedule" || step.scope === "session"),
    },
  };
}

/** Reports whether the catalog needs a guest count for pricing or eligibility. */
export function cateringCatalogNeedsGuestCount(
  pricingModel: CateringServicePublic["pricingModel"],
  catalog?: CateringCatalogPublic | null,
): boolean {
  if (pricingModel !== "per_unit") return true;
  return Boolean(
    catalog?.items.some((item) => item.minGuests > 0)
      || catalog?.items.some((item) => item.options?.some((option) => option.priceMode === "per_person"))
      || catalog?.options.some((option) => option.priceMode === "per_person"),
  );
}

/** Builds the default search used when an offer group has no custom journey.
 * Each entry is rendered as one screen by the flow wizard. */
export function defaultCateringSearchFlow(
  t: (key: string) => string,
  includeGuestCount = true,
): CateringFlowConfigPublic {
  return {
    version: 3,
    enabled: true,
    steps: [
      ...(includeGuestCount ? [{
        id: "search_guests",
        kind: "guest_count" as const,
        scope: "booking" as const,
        title: t("catering_search_guests_title"),
        description: t("catering_search_guests_hint"),
        required: true,
      }] : []),
      {
        id: "search_dates",
        kind: "schedule",
        scope: "booking",
        title: t("catering_search_dates_title"),
        description: t("catering_search_dates_hint"),
        required: true,
        schedule: { mode: "custom", min_sessions: 1, max_sessions: 1, allow_same_day: false, date_only: true },
      },
    ],
  };
}

function dateWeekday(date: string | undefined): number | null {
  if (!date) return null;
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getDay();
}

export type CateringOfferSearchState = "compatible" | "guest_minimum" | "unavailable_date";

/** Returns the lowest guest count at which an offer can produce a price.
 * `minGuests` remains authoritative. For older offers where it was left empty,
 * a zero base price plus tiered/central rates is treated as an implicit minimum. */
export function cateringOfferMinimumGuests(
  item: CateringCatalogItemPublic,
  config?: CateringFlowConfigPublic,
  date?: string,
): number {
  if (item.minGuests > 0) return item.minGuests;
  if (item.basePrice > 0 || item.serviceModes.some((mode) => (mode.price ?? 0) > 0)) return 0;

  const candidates = item.priceTiers
    .filter((tier) => tier.minGuests > 0 && tier.price > 0)
    .map((tier) => tier.minGuests);
  const weekday = dateWeekday(date);
  const pricingRules = config?.pricing?.rules?.filter((rule) => rule.catalog_item_id === item.id) ?? [];
  for (const rule of pricingRules) {
    const weekdayCondition = rule.conditions?.find((condition) => condition.factor === "weekday");
    if (weekdayCondition && weekday !== null) {
      const expected = String(weekday);
      const matches = weekdayCondition.operator === "equals"
        ? weekdayCondition.value === expected
        : weekdayCondition.operator === "one_of" && weekdayCondition.values?.includes(expected);
      if (!matches) continue;
    }
    const guestCondition = rule.conditions?.find((condition) => condition.factor === "guest_count");
    if (!guestCondition) return 0;
    const minimum = Number(guestCondition.min_value);
    if (Number.isFinite(minimum) && minimum > 0 && rule.catalog_per_guest_rate > 0) candidates.push(minimum);
  }
  return candidates.length > 0 ? Math.min(...candidates) : 0;
}

/** Classifies an offer without losing the reason it cannot be selected. */
export function cateringOfferSearchState(
  item: CateringCatalogItemPublic,
  guests: number,
  date: string | undefined,
  config?: CateringFlowConfigPublic,
): CateringOfferSearchState {
  const weekday = dateWeekday(date);
  if (item.availableWeekdays.length > 0 && weekday !== null && !item.availableWeekdays.includes(weekday)) return "unavailable_date";
  const minimumGuests = cateringOfferMinimumGuests(item, config, date);
  if (minimumGuests > 0 && guests < minimumGuests) return "guest_minimum";
  return "compatible";
}

/** Matches the same guest/day eligibility constraints enforced by the quote API. */
export function offerMatchesCateringSearch(
  item: CateringCatalogItemPublic,
  guests: number,
  date: string | undefined,
  config?: CateringFlowConfigPublic,
): boolean {
  return cateringOfferSearchState(item, guests, date, config) === "compatible";
}
