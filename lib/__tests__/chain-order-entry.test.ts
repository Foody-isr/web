import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchChainOrderEntry, resolveChainOrderBranches, trackChainOrderEntryEvent } from "../../services/api";

test("chain order entry maps the public snake-case contract", async () => {
  const originalFetch = globalThis.fetch;
  let requested = "";
  globalThis.fetch = async (input) => {
    requested = String(input);
    return new Response(
      JSON.stringify({
        chain: {
          id: 7,
          name: "Moulin Dorée",
          slug: "moulin-doree",
          logo_url: "https://cdn.example/logo.png",
          default_locale: "fr",
        },
        branches: [
          {
            restaurant_id: 41,
            name: "Jérusalem — Talpiot",
            slug: "moulin-doree-jerusalem",
            address: "18 Bakery Street",
            timezone: "Asia/Jerusalem",
            pickup_enabled: true,
            delivery_enabled: false,
            dine_in_enabled: false,
            orders_paused: false,
            is_open: true,
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  try {
    const entry = await fetchChainOrderEntry("moulin-doree", "pickup");
    assert.match(requested, /\/public\/chains\/moulin-doree\/order-entry\?order_type=pickup$/);
    assert.equal(entry.chain.defaultLocale, "fr");
    assert.equal(entry.branches[0].restaurantId, 41);
    assert.equal(entry.branches[0].pickupEnabled, true);
    assert.equal(entry.branches[0].isOpen, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("delivery resolution posts the address and maps matched terms", async () => {
  const originalFetch = globalThis.fetch;
  let requested = "";
  let body = "";
  globalThis.fetch = async (input, init) => {
    requested = String(input);
    body = String(init?.body);
    return new Response(JSON.stringify({
      resolved: true,
      branches: [{
        restaurant_id: 42,
        name: "Centre",
        slug: "centre",
        timezone: "Asia/Jerusalem",
        pickup_enabled: true,
        delivery_enabled: true,
        dine_in_enabled: false,
        orders_paused: false,
        is_open: true,
        distance_km: 1.25,
        delivery_fee: 14,
        minimum_order: 60,
      }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    const result = await resolveChainOrderBranches("moulin-doree", {
      orderType: "delivery",
      address: "18 Bakery Street",
    });
    assert.match(requested, /\/public\/chains\/moulin-doree\/resolve-order-branch$/);
    assert.deepEqual(JSON.parse(body), {
      order_type: "delivery",
      address: "18 Bakery Street",
    });
    assert.equal(result.branches[0].restaurantId, 42);
    assert.equal(result.branches[0].distanceKm, 1.25);
    assert.equal(result.branches[0].deliveryFee, 14);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("delivery resolution preserves outside-zone reason", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ resolved: true, reason: "outside_zone", branches: [] }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
  try {
    const result = await resolveChainOrderBranches("moulin-doree", {
      orderType: "delivery", latitude: 31.7, longitude: 35.2,
    });
    assert.equal(result.reason, "outside_zone");
    assert.deepEqual(result.branches, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("order-entry tracking sends no customer or address data", async () => {
  const originalFetch = globalThis.fetch;
  let body = "";
  globalThis.fetch = async (_input, init) => {
    body = String(init?.body);
    return new Response(null, { status: 204 });
  };
  try {
    await trackChainOrderEntryEvent("moulin-doree", {
      event: "branch_selected", orderType: "pickup", locale: "fr", restaurantId: 41,
    });
    assert.deepEqual(JSON.parse(body), {
      event: "branch_selected",
      order_type: "pickup",
      locale: "fr",
      restaurant_id: 41,
    });
    assert.equal(body.includes("address"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
