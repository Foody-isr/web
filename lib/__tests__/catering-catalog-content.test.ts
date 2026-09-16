import assert from "node:assert/strict";
import test from "node:test";
import { cateringCatalogItemSummary } from "../cateringCatalogContent";
import type { CateringCatalogItemPublic } from "../../services/api";

function item(overrides: Partial<CateringCatalogItemPublic> = {}): CateringCatalogItemPublic {
  return {
    id: 1,
    serviceId: 2,
    groupId: 3,
    name: "Plateau campagne",
    slug: "plateau-campagne",
    overview: "",
    description: "Or rouge, labneh et zaatar",
    portion: "35 × 25 cm",
    imageUrl: "",
    basePrice: 260,
    serviceModes: [],
    availableWeekdays: [],
    priceTiers: [],
    minQuantity: 0,
    minGuests: 0,
    eventType: "",
    choiceGroups: [],
    includedItems: [],
    ...overrides,
  };
}

test("catering cards fall back to the article description", () => {
  assert.equal(cateringCatalogItemSummary(item(), "fr"), "Or rouge, labneh et zaatar");
});

test("catering cards prefer the localized editorial overview", () => {
  assert.equal(cateringCatalogItemSummary(item({
    overview: "A generous platter",
    translations: { overview: { fr: "Un plateau généreux" } },
  }), "fr"), "Un plateau généreux");
});
