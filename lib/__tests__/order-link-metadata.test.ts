import assert from "node:assert/strict";
import { test } from "node:test";
import { buildItemOgImageUrl, buildRestaurantOgImageUrl } from "../og";
import { buildOrderLinkMetadata } from "../orderLinkMetadata";
import type { Restaurant } from "../types";

const APP_URL = "https://app.example.test";
const labels = { receipt: "Receipt", confirmation: "Order confirmation", tracking: "Order tracking" } as const;
const kinds = ["receipt", "confirmation", "tracking"] as const;

for (const kind of kinds) {
  test(`${kind} previews follow each restaurant rather than shared Foody branding`, () => {
    for (const name of ["Mamie", "Bistro du Marché", "מסעדת הדג"]) {
      const logoUrl = `https://images.example.test/${encodeURIComponent(name)}.png`;
      const metadata = buildOrderLinkMetadata(kind, { name, logoUrl }, APP_URL);
      const images = metadata.openGraph?.images as {
        url: string;
        alt: string;
      }[];
      const image = new URL(images[0].url);

      assert.equal(
        metadata.title,
        `${labels[kind]} | ${name}`,
      );
      assert.equal(metadata.openGraph?.title, metadata.title);
      assert.equal(metadata.twitter?.title, metadata.title);
      assert.equal(metadata.openGraph?.siteName, name);
      assert.equal(images[0].alt, name);
      assert.equal(image.origin, APP_URL);
      assert.equal(image.pathname, "/api/og");
      assert.equal(image.searchParams.get("name"), name);
      assert.equal(image.searchParams.get("logo"), logoUrl);
      assert.equal(image.searchParams.get("v"), "2");
      assert.deepEqual(metadata.twitter?.images, [image.toString()]);
      assert.deepEqual(metadata.robots, { index: false, follow: false });
    }
  });
}

for (const mode of ["cover", "logo"] as const) {
  test(`the site, items and order links share the configured ${mode} image`, () => {
    const restaurant = {
      name: "Demo Restaurant",
      logoUrl: "https://images.example.test/logo.png",
      websiteConfig: {
        shareImageUrl: "https://images.example.test/restaurant-share.png",
        shareImageMode: mode,
        shareImageBg: "brand",
        themeId: "custom",
        customPalette: {
          mode: "dark",
          bg: "#123456",
          surface: "#111111",
          accent: "#ffcc00",
          ink: "#ffffff",
        },
      },
    } as Restaurant;
    const websiteImage = buildRestaurantOgImageUrl(restaurant, APP_URL);
    const image = new URL(websiteImage);
    if (mode === "cover") {
      assert.equal(image.searchParams.get("url"), "images.example.test/restaurant-share.png");
    } else {
      assert.equal(image.searchParams.get("logo"), restaurant.websiteConfig?.shareImageUrl);
      assert.equal(image.searchParams.get("bg"), "#123456");
    }
    assert.equal(buildItemOgImageUrl({
      restaurant,
      appUrl: APP_URL,
      itemName: "Seasonal salad",
      itemImageUrl: "https://images.example.test/item.png",
    }), websiteImage);
    for (const kind of kinds) {
      const metadata = buildOrderLinkMetadata(kind, restaurant, APP_URL);
      const images = metadata.openGraph?.images as { url: string }[];
      assert.equal(images[0].url, websiteImage);
      assert.deepEqual(metadata.twitter?.images, [websiteImage]);
    }
  });
}

test("a restaurant without a share image or logo uses its cover for all generic links", () => {
  const restaurant = { name: "Bistro", coverUrl: "https://images.example.test/cover.jpg" };
  const websiteImage = buildRestaurantOgImageUrl(restaurant, APP_URL);
  assert.equal(new URL(websiteImage).searchParams.get("url"), "images.example.test/cover.jpg");
  for (const kind of kinds) {
    assert.deepEqual(buildOrderLinkMetadata(kind, restaurant, APP_URL).twitter?.images, [websiteImage]);
  }
});

test("restaurants without a logo retain a restaurant name card", () => {
  const metadata = buildOrderLinkMetadata(
    "confirmation",
    { name: "Demo Café" },
    APP_URL,
  );
  const images = metadata.openGraph?.images as { url: string }[];
  const image = new URL(images[0].url);

  assert.equal(image.searchParams.get("name"), "Demo Café");
  assert.equal(image.searchParams.has("logo"), false);
  assert.equal(JSON.stringify(metadata).includes("Foody"), false);
});

test("unavailable or unnamed restaurants override inherited generic previews", () => {
  for (const kind of kinds) {
    for (const restaurant of [null, { name: "   " }]) {
      const metadata = buildOrderLinkMetadata(kind, restaurant, APP_URL);
      assert.equal(metadata.title, labels[kind]);
      assert.deepEqual(metadata.openGraph?.images, []);
      assert.deepEqual(metadata.twitter?.images, []);
      assert.deepEqual(metadata.robots, { index: false, follow: false });
      assert.equal(JSON.stringify(metadata).includes("Foody"), false);
    }
  }
});

test("metadata excludes customer/order fields and private link tokens", () => {
  const restaurant = {
    name: "Demo Restaurant",
    logoUrl: "https://images.example.test/logo.png",
    customer_name: "PRIVATE_CUSTOMER",
    customer_phone: "PRIVATE_PHONE",
    receipt_token: "PRIVATE_TOKEN",
    total_amount: "PRIVATE_TOTAL",
    orderId: "PRIVATE_ORDER_ID",
    description: "PRIVATE_DESCRIPTION",
    websiteConfig: {
      shareImageUrl: "https://images.example.test/PUBLIC_SHARE.png",
    } as Restaurant["websiteConfig"],
  };

  for (const kind of kinds) {
    const metadata = buildOrderLinkMetadata(kind, restaurant, APP_URL);
    assert.doesNotMatch(JSON.stringify(metadata), /PRIVATE_/);
    assert.equal(metadata.alternates, undefined);
    assert.equal(metadata.openGraph && "url" in metadata.openGraph, false);
  }
});
