import assert from "node:assert/strict";
import test from "node:test";
import { defaultCateringSearchFlow, offerMatchesCateringSearch } from "../cateringSearch";
import type { CateringCatalogItemPublic } from "../../services/api";

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

test("offer search combines guest minimum and available weekdays", () => {
  const fridayOffer = offer({ minGuests: 20, availableWeekdays: [5] });
  assert.equal(offerMatchesCateringSearch(fridayOffer, 20, "2026-08-28", "per_person"), true);
  assert.equal(offerMatchesCateringSearch(fridayOffer, 19, "2026-08-28", "per_person"), false);
  assert.equal(offerMatchesCateringSearch(fridayOffer, 20, "2026-08-29", "per_person"), false);
  assert.equal(offerMatchesCateringSearch(offer(), 1, "2026-08-29", "per_person"), true);
});
