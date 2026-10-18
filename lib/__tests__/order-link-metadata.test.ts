import assert from "node:assert/strict";
import { test } from "node:test";
import { buildOrderLinkMetadata } from "../orderLinkMetadata";
import type { Restaurant } from "../types";

const APP_URL = "https://app.example.test";

for (const kind of ["receipt", "confirmation"] as const) {
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
        `${kind === "receipt" ? "Receipt" : "Order confirmation"} | ${name}`,
      );
      assert.equal(metadata.openGraph?.title, metadata.title);
      assert.equal(metadata.twitter?.title, metadata.title);
      assert.equal(metadata.openGraph?.siteName, name);
      assert.equal(images[0].alt, name);
      assert.equal(image.origin, APP_URL);
      assert.equal(image.pathname, "/api/og");
      assert.equal(image.searchParams.get("name"), name);
      assert.equal(image.searchParams.get("logo"), logoUrl);
      assert.deepEqual(metadata.twitter?.images, [image.toString()]);
      assert.deepEqual(metadata.robots, { index: false, follow: false });
    }
  });
}

test("order links use the logo even when the website has a different share image", () => {
  const restaurant = {
    name: "Demo Restaurant",
    logoUrl: "https://images.example.test/logo.png",
    websiteConfig: {
      shareImageUrl: "https://images.example.test/advert.jpg",
      shareImageMode: "cover",
      shareImageBg: "brand",
      brandColor: "#123456",
    },
  } as Restaurant;
  const metadata = buildOrderLinkMetadata("receipt", restaurant, APP_URL);
  const images = metadata.openGraph?.images as { url: string }[];
  const image = new URL(images[0].url);

  assert.equal(image.searchParams.get("logo"), restaurant.logoUrl);
  assert.equal(image.searchParams.get("bg"), "#123456");
  assert.equal(JSON.stringify(metadata).includes("advert.jpg"), false);
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
  for (const restaurant of [null, { name: "   " }]) {
    const metadata = buildOrderLinkMetadata("receipt", restaurant, APP_URL);
    assert.equal(metadata.title, "Receipt");
    assert.deepEqual(metadata.openGraph?.images, []);
    assert.deepEqual(metadata.twitter?.images, []);
    assert.deepEqual(metadata.robots, { index: false, follow: false });
    assert.equal(JSON.stringify(metadata).includes("Foody"), false);
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
      shareImageUrl: "https://images.example.test/PRIVATE_SHARE.png",
    } as Restaurant["websiteConfig"],
  };

  for (const kind of ["receipt", "confirmation"] as const) {
    const metadata = buildOrderLinkMetadata(kind, restaurant, APP_URL);
    assert.doesNotMatch(JSON.stringify(metadata), /PRIVATE_/);
    assert.equal(metadata.alternates, undefined);
    assert.equal(metadata.openGraph && "url" in metadata.openGraph, false);
  }
});
