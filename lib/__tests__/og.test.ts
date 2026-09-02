import { test } from "node:test";
import assert from "node:assert/strict";
import { buildItemOgImageUrl, buildRestaurantOgImageUrl } from "../og";
import type { Restaurant, WebsiteConfig } from "../types";

const APP = "https://app.foody-pos.co.il";

function config(p: Partial<WebsiteConfig>): WebsiteConfig {
  return p as WebsiteConfig;
}

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

test("buildRestaurantOgImageUrl falls back to the logo on a white card", () => {
  const out = buildRestaurantOgImageUrl(
    resto({ logoUrl: "https://cdn.example.com/logo.png" }),
    APP,
  );
  const u = new URL(out);
  assert.equal(u.pathname, "/api/og");
  assert.equal(u.searchParams.get("logo"), "https://cdn.example.com/logo.png");
  assert.equal(u.searchParams.get("bg"), "#FFFFFF");
});

test("buildRestaurantOgImageUrl prefers the site share image over the logo", () => {
  const out = buildRestaurantOgImageUrl(
    resto({
      logoUrl: "https://cdn.example.com/logo.png",
      websiteConfig: config({
        shareImageUrl: "https://cdn.example.com/share.png",
        shareImageMode: "logo",
        shareImageBg: "black",
      }),
    }),
    APP,
  );
  const u = new URL(out);
  assert.equal(u.searchParams.get("logo"), "https://cdn.example.com/share.png");
  assert.equal(u.searchParams.get("bg"), "#000000");
});

test("buildRestaurantOgImageUrl resolves the brand background from the site brand colour", () => {
  const out = buildRestaurantOgImageUrl(
    resto({
      logoUrl: "https://cdn.example.com/logo.png",
      backgroundColor: "#111111",
      websiteConfig: config({ shareImageBg: "brand", brandColor: "#B08D57" }),
    }),
    APP,
  );
  assert.equal(new URL(out).searchParams.get("bg"), "#B08D57");
});

test("buildRestaurantOgImageUrl falls back to white when the brand colour is unusable", () => {
  const out = buildRestaurantOgImageUrl(
    resto({
      logoUrl: "https://cdn.example.com/logo.png",
      websiteConfig: config({ shareImageBg: "brand", brandColor: "not-a-hex" }),
    }),
    APP,
  );
  assert.equal(new URL(out).searchParams.get("bg"), "#FFFFFF");
});

test("buildRestaurantOgImageUrl serves the share image edge-to-edge in cover mode", () => {
  const out = buildRestaurantOgImageUrl(
    resto({
      logoUrl: "https://cdn.example.com/logo.png",
      websiteConfig: config({
        shareImageUrl: "https://cdn.example.com/banner.jpg",
        shareImageMode: "cover",
      }),
    }),
    APP,
  );
  const u = new URL(out);
  assert.equal(u.host, "images.weserv.nl");
  assert.equal(u.searchParams.get("url"), "cdn.example.com/banner.jpg");
  assert.equal(u.searchParams.get("w"), "1200");
  assert.equal(u.searchParams.get("h"), "630");
  assert.equal(u.searchParams.get("output"), "jpg");
});

test("buildRestaurantOgImageUrl ignores a blank share image", () => {
  const out = buildRestaurantOgImageUrl(
    resto({
      logoUrl: "https://cdn.example.com/logo.png",
      websiteConfig: config({ shareImageUrl: "   ", shareImageMode: "cover" }),
    }),
    APP,
  );
  assert.equal(
    new URL(out).searchParams.get("logo"),
    "https://cdn.example.com/logo.png",
  );
});

test("buildRestaurantOgImageUrl keeps the cover photo when nothing else is set", () => {
  const out = buildRestaurantOgImageUrl(
    resto({ coverUrl: "https://cdn.example.com/cover.jpg" }),
    APP,
  );
  assert.equal(new URL(out).host, "images.weserv.nl");
});
