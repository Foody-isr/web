import test from "node:test";
import assert from "node:assert/strict";
import {
  inheritChainWebsitePresentation,
  isLocalChainWebsite,
} from "../chainWebsite";
import type { Restaurant } from "../types";

function restaurant(input: Partial<Restaurant> & Pick<Restaurant, "id" | "name">): Restaurant {
  return {
    deliveryEnabled: false,
    pickupEnabled: true,
    dineInEnabled: false,
    ...input,
  };
}

test("a non-primary chain restaurant uses the local website mode", () => {
  assert.equal(isLocalChainWebsite(restaurant({ id: 26, name: "Raanana", chainPrimaryRestaurantId: 24 })), true);
  assert.equal(isLocalChainWebsite(restaurant({ id: 24, name: "Moulin", chainPrimaryRestaurantId: 24 })), false);
  assert.equal(isLocalChainWebsite(restaurant({ id: 30, name: "Independent" })), false);
});

test("chain presentation inherits the brand while preserving local commerce identity", () => {
  const local = restaurant({
    id: 26,
    name: "Raanana",
    slug: "raanana",
    address: "Ahuza",
    logoUrl: "local-logo.png",
    chainPrimaryRestaurantId: 24,
  });
  const brand = restaurant({
    id: 24,
    name: "Moulin Dorée",
    slug: "moulin-doree",
    logoUrl: "brand-logo.png",
    coverUrl: "brand-cover.jpg",
    backgroundColor: "#111111",
    websiteConfig: {
      themeId: "editorial-dark",
      pairingId: "modern-sans",
      brandColor: null,
      layoutDefault: "magazine",
      heroLayout: "standard",
      showAddress: true,
      showPhone: true,
      showHours: true,
    },
    websiteSections: [],
  });

  const inherited = inheritChainWebsitePresentation(local, brand);
  assert.equal(inherited.id, 26);
  assert.equal(inherited.slug, "raanana");
  assert.equal(inherited.address, "Ahuza");
  assert.equal(inherited.logoUrl, "local-logo.png");
  assert.equal(inherited.coverUrl, "brand-cover.jpg");
  assert.equal(inherited.websiteConfig, brand.websiteConfig);
});
