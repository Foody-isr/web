import { test } from "node:test";
import assert from "node:assert/strict";
import { buildItemOgImageUrl } from "../og";
import type { Restaurant } from "../types";

function resto(p: Partial<Restaurant> = {}): Restaurant {
  return {
    id: 1,
    name: "Mamie Tlv",
    deliveryEnabled: true,
    pickupEnabled: true,
    dineInEnabled: true,
    ...p,
  } as Restaurant;
}

test("buildItemOgImageUrl includes item name, restaurant name and image", () => {
  const out = buildItemOgImageUrl({
    itemName: "Salade Tuna",
    itemImageUrl: "https://cdn.example.com/x.jpg",
    restaurant: resto({ backgroundColor: "#FF5733" }),
    appUrl: "https://app.foody-pos.co.il",
  });
  const u = new URL(out);
  assert.equal(u.pathname, "/api/og/item");
  assert.equal(u.searchParams.get("iname"), "Salade Tuna");
  assert.equal(u.searchParams.get("rname"), "Mamie Tlv");
  assert.equal(u.searchParams.get("img"), "https://cdn.example.com/x.jpg");
  assert.equal(u.searchParams.get("bg"), "#FF5733");
});

test("buildItemOgImageUrl omits img when item has no photo", () => {
  const out = buildItemOgImageUrl({
    itemName: "Coca",
    restaurant: resto(),
    appUrl: "https://app.foody-pos.co.il",
  });
  const u = new URL(out);
  assert.equal(u.searchParams.has("img"), false);
  assert.equal(u.searchParams.has("bg"), false);
  assert.equal(u.searchParams.get("iname"), "Coca");
});
