import assert from "node:assert/strict";
import test from "node:test";
import { structuredInclusionGroups } from "../cateringInclusions";
import type { CateringCatalogItemPublic } from "../../services/api";

function formula(): CateringCatalogItemPublic {
  return {
    id: 1,
    serviceId: 2,
    groupId: null,
    name: "Halavi",
    slug: "halavi",
    overview: "",
    description: "",
    imageUrl: "",
    serviceModes: [],
    availableWeekdays: [],
    basePrice: 200,
    priceTiers: [],
    minQuantity: 0,
    minGuests: 30,
    eventType: "",
    choiceGroups: [],
    includedSections: [{
      id: 10,
      name: "Pain & dips",
      description: "À partager",
      translations: { name: { fr: "Pains et dips" }, description: { fr: "À partager" } },
      items: [{ id: 11, sectionId: 10, menuItemId: 3, name: "Houmous", description: "" }],
    }],
    // The API intentionally keeps sectioned rows in this flattened list for
    // older clients. The new hierarchy must not render Houmous twice.
    includedItems: [
      { id: 11, sectionId: 10, menuItemId: 3, name: "Houmous", description: "" },
      { id: 12, sectionId: null, menuItemId: null, name: "Service et vaisselle", description: "" },
    ],
  };
}

test("catering inclusions preserve sections and de-duplicate the compatibility list", () => {
  assert.deepEqual(structuredInclusionGroups(formula(), "fr"), [
    { id: "section-10", title: "Pains et dips", description: "À partager", items: ["Houmous"] },
    { id: "unsectioned", title: "", description: "", items: ["Service et vaisselle"] },
  ]);
});
