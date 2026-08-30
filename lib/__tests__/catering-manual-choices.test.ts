import assert from "node:assert/strict";
import test from "node:test";

import { fetchCateringCatalog } from "@/services/api";

test("catering catalog maps offer-specific choices without a library article", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/groups?")) {
      return new Response(JSON.stringify({ groups: [] }), { status: 200 });
    }
    if (url.includes("/options?")) {
      return new Response(JSON.stringify({ options: [] }), { status: 200 });
    }
    return new Response(JSON.stringify({
      items: [{
        id: 10,
        service_id: 2,
        name: "Vendredi soir",
        slug: "vendredi-soir",
        description: "",
        image_url: "",
        base_price: 170,
        min_quantity: 0,
        min_guests: 30,
        choice_groups: [{
          id: 20,
          name: "Choisissez un poisson",
          min_selections: 1,
          max_selections: 1,
          max_per_item: 1,
          items: [{
            id: 30,
            menu_item_id: null,
            name: "Poisson du marché",
            description: "Selon arrivage",
            image_url: "",
            price_delta: 5,
            default_quantity: 0,
          }],
        }],
      }],
    }), { status: 200 });
  };

  try {
    const catalog = await fetchCateringCatalog(1, 2);
    assert.deepEqual(catalog.items[0].choiceGroups[0].items[0], {
      id: 30,
      menuItemId: null,
      name: "Poisson du marché",
      description: "Selon arrivage",
      imageUrl: "",
      priceDelta: 5,
      defaultQuantity: 0,
      translations: {},
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
