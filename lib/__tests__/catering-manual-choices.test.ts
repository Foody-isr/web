import assert from "node:assert/strict";
import test from "node:test";

import { createCateringQuote, fetchCateringCatalog } from "@/services/api";

test("catering catalog maps offer-specific choices without a library article", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/groups?")) {
      return new Response(JSON.stringify({ groups: [] }), { status: 200 });
    }
    if (url.includes("/options?")) {
      return new Response(JSON.stringify({ options: [{
        id: 40,
        catalog_item_id: 10,
        name: "Serveur supplémentaire",
        description: "Quatre heures",
        price: 250,
        price_mode: "per_unit",
      }] }), { status: 200 });
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
    assert.deepEqual(catalog.options[0], {
      id: 40,
      catalogItemId: 10,
      name: "Serveur supplémentaire",
      description: "Quatre heures",
      price: 250,
      priceMode: "per_unit",
      translations: {},
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("catering quote sends offer option quantities", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: unknown;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({
      id: 1,
      public_token: "quote",
      service_id: 2,
      status: "auto_approved",
      total: 670,
      guests: 30,
      config: {},
      deposit_status: "none",
      deposit_amount: 0,
    }), { status: 200 });
  };

  try {
    await createCateringQuote({
      restaurantId: 1,
      serviceId: 2,
      guests: 30,
      customerName: "Jane",
      customerPhone: "050",
      eventCity: "Tel Aviv",
      items: [{ catalogItemId: 10, quantity: 1 }],
      choices: [],
      optionIds: [],
      options: [{ optionId: 40, quantity: 2 }],
    });
    assert.deepEqual((requestBody as { options: unknown }).options, [{ option_id: 40, quantity: 2 }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
