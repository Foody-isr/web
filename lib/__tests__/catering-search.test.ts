import assert from "node:assert/strict";
import test from "node:test";
import { cateringCatalogNeedsGuestCount, cateringDateIsAtCheckout, cateringOfferMinimumGuests, cateringOfferSearchState, defaultCateringSearchFlow, offerMatchesCateringSearch, splitCateringFlowByDateTiming } from "../cateringSearch";
import type { CateringCatalogItemPublic, CateringCatalogPublic, CateringFlowConfigPublic, CateringServicePublic } from "../../services/api";

function offer(patch: Partial<CateringCatalogItemPublic> = {}): CateringCatalogItemPublic {
  return {
    id: 1,
    serviceId: 1,
    groupId: null,
    name: "Vendredi soir",
    slug: "vendredi-soir",
    overview: "",
    description: "",
    imageUrl: "",
    basePrice: 170,
    serviceModes: [],
    availableWeekdays: [],
    priceTiers: [],
    minQuantity: 0,
    minGuests: 0,
    eventType: "",
    choiceGroups: [],
    includedItems: [],
    ...patch,
  };
}

test("the default catering search asks guests then one date, one screen each", () => {
  const flow = defaultCateringSearchFlow((key) => key);
  assert.deepEqual(flow.steps.map((step) => step.kind), ["guest_count", "schedule"]);
  assert.equal(flow.steps[1].schedule?.date_only, true);
  assert.equal(flow.steps[1].schedule?.max_sessions, 1);
});

test("the default search omits guests for unit products that do not depend on them", () => {
  const flow = defaultCateringSearchFlow((key) => key, false);
  assert.deepEqual(flow.steps.map((step) => step.kind), ["schedule"]);
  assert.equal(flow.steps[0].schedule?.date_only, true);
});

test("unit services default to collecting the date at checkout", () => {
  const service = (pricingModel: CateringServicePublic["pricingModel"], dateSelectionTiming?: CateringServicePublic["dateSelectionTiming"]): CateringServicePublic => ({
    id: 1,
    name: "Plateaux",
    slug: "plateaux",
    description: "",
    pricingModel,
    dateSelectionTiming,
    quoteMode: "auto",
    depositPct: 0,
    selectionMode: "multiple",
    allowExtraSessions: false,
    maxSessions: 3,
  });
  assert.equal(cateringDateIsAtCheckout(service("per_unit")), true);
  assert.equal(cateringDateIsAtCheckout(service("per_person")), false);
  assert.equal(cateringDateIsAtCheckout(service("per_unit", "before_catalog")), false);
  assert.equal(cateringDateIsAtCheckout(service("per_person", "checkout")), true);
});

test("date-at-checkout journeys keep booking questions early and move schedule/session questions late", () => {
  const flow: CateringFlowConfigPublic = {
    version: 3,
    enabled: true,
    steps: [
      { id: "guests", kind: "guest_count", scope: "booking", title: "Guests", required: true },
      { id: "occasion", kind: "single_choice", scope: "booking", title: "Occasion", required: true, options: [] },
      { id: "date", kind: "schedule", scope: "booking", title: "Date", required: true, schedule: { mode: "custom", min_sessions: 1, max_sessions: 1, allow_same_day: false } },
      { id: "delivery", kind: "single_choice", scope: "session", title: "Delivery", required: true, options: [] },
    ],
  };
  const split = splitCateringFlowByDateTiming(flow, true);
  assert.deepEqual(split.beforeCatalog.steps.map((step) => step.id), ["guests", "occasion"]);
  assert.deepEqual(split.checkout?.steps.map((step) => step.id), ["date", "delivery"]);
  assert.equal(splitCateringFlowByDateTiming(flow, false).checkout, undefined);
});

test("unit catalogs ask for guests only when eligibility or pricing needs them", () => {
  const catalog = (items: CateringCatalogItemPublic[], priceMode: "fixed" | "per_person" | "per_unit" = "fixed"): CateringCatalogPublic => ({
    groups: [],
    items,
    options: priceMode === "fixed" ? [] : [{ id: 1, catalogItemId: null, name: "Extra", description: "", price: 10, priceMode }],
  });

  assert.equal(cateringCatalogNeedsGuestCount("per_unit", catalog([offer()])), false);
  assert.equal(cateringCatalogNeedsGuestCount("per_unit", catalog([offer({ minGuests: 10 })])), true);
  assert.equal(cateringCatalogNeedsGuestCount("per_unit", catalog([offer({ options: [{ id: 2, catalogItemId: 1, name: "Staff", description: "", price: 25, priceMode: "per_person" }] })])), true);
  assert.equal(cateringCatalogNeedsGuestCount("per_unit", catalog([offer()], "per_person")), true);
  assert.equal(cateringCatalogNeedsGuestCount("per_person", catalog([offer()])), true);
  assert.equal(cateringCatalogNeedsGuestCount("custom_quote", catalog([offer()])), true);
});

test("offer search combines guest minimum and available weekdays", () => {
  const fridayOffer = offer({ minGuests: 20, availableWeekdays: [5] });
  assert.equal(offerMatchesCateringSearch(fridayOffer, 20, "2026-08-28"), true);
  assert.equal(offerMatchesCateringSearch(fridayOffer, 19, "2026-08-28"), false);
  assert.equal(offerMatchesCateringSearch(fridayOffer, 20, "2026-08-29"), false);
  assert.equal(offerMatchesCateringSearch(offer(), 1, "2026-08-29"), true);
});

test("offer search distinguishes guest suggestions from date mismatches", () => {
  const fridayOffer = offer({ minGuests: 30, availableWeekdays: [5] });
  assert.equal(cateringOfferSearchState(fridayOffer, 1, "2026-08-28"), "guest_minimum");
  assert.equal(cateringOfferSearchState(fridayOffer, 30, "2026-08-29"), "unavailable_date");
  assert.equal(cateringOfferSearchState(fridayOffer, 30, "2026-08-28"), "compatible");
});

test("legacy zero-price offers infer eligibility from their first priced guest band", () => {
  const tiered = offer({ basePrice: 0, priceTiers: [{ minGuests: 30, price: 170 }, { minGuests: 60, price: 150 }] });
  assert.equal(cateringOfferMinimumGuests(tiered), 30);
  assert.equal(cateringOfferSearchState(tiered, 1, "2026-08-28"), "guest_minimum");

  const central = offer({ id: 42, basePrice: 0 });
  const flow: CateringFlowConfigPublic = {
    version: 3,
    enabled: true,
    steps: [],
    pricing: { rules: [
      { id: "friday", label: "Friday", catalog_item_id: 42, catalog_per_guest_rate: 170, conditions: [
        { factor: "weekday", operator: "equals", value: "5" },
        { factor: "guest_count", operator: "between", min_value: "30", max_value: "59" },
      ] },
      { id: "friday-large", label: "Friday large", catalog_item_id: 42, catalog_per_guest_rate: 150, conditions: [
        { factor: "weekday", operator: "equals", value: "5" },
        { factor: "guest_count", operator: "between", min_value: "60", max_value: "999999" },
      ] },
    ] },
  };
  assert.equal(cateringOfferMinimumGuests(central, flow, "2026-08-28"), 30);
  assert.equal(cateringOfferSearchState(central, 1, "2026-08-28", flow), "guest_minimum");
});
