import assert from "node:assert/strict";
import { test } from "node:test";
import type { Restaurant } from "@/lib/types";
import type { WebsiteV3Page } from "@/lib/websiteV3Api";
import {
  resolveWebsiteV3Seo,
  websiteV3PageMetadata,
} from "../websiteV3Metadata";

const restaurant = {
  id: 9,
  name: "Bistro V3",
  slug: "bistro-v3",
  description: "Seasonal food in Tel Aviv.",
  coverUrl: "https://images.example.test/cover.jpg",
} as Restaurant;

const page = {
  id: 42,
  restaurant_id: 9,
  type: "content",
  slug: "about",
  title: "About us",
  sort_order: 1,
  nav_visible: true,
  is_homepage: false,
  is_default: false,
  seo: {
    title: "Bistro V3 story",
    description: "Meet the people behind Bistro V3.",
    share_image_url: "https://images.example.test/share.jpg",
  },
  settings: {},
  appearance_overrides: {},
  sections: [],
  created_at: "2026-07-30T09:15:00Z",
  updated_at: "2026-07-30T10:30:00Z",
} as WebsiteV3Page;

test("Website V3 SEO prefers the page values in public metadata", () => {
  const seo = resolveWebsiteV3Seo({
    restaurant,
    page,
    appUrl: "https://app.example.test",
    routeRestaurantId: "bistro-v3",
  });
  const metadata = websiteV3PageMetadata(seo);

  assert.deepEqual(seo, {
    title: "Bistro V3 story",
    description: "Meet the people behind Bistro V3.",
    imageUrl: "https://images.example.test/share.jpg",
    canonicalUrl: "https://app.example.test/r/bistro-v3/about",
  });
  assert.equal(metadata.title, "Bistro V3 story");
  assert.equal(metadata.description, "Meet the people behind Bistro V3.");
  assert.deepEqual(metadata.alternates, {
    canonical: "https://app.example.test/r/bistro-v3/about",
  });
  assert.deepEqual(metadata.openGraph?.images, [
    { url: "https://images.example.test/share.jpg" },
  ]);
});

test("Website V3 SEO safely falls back to restaurant branding", () => {
  const seo = resolveWebsiteV3Seo({
    restaurant: { ...restaurant, name: "", description: "", coverUrl: "" },
    page: {
      ...page,
      type: "landing",
      slug: "home",
      title: "",
      seo: {
        title: "  ",
        description: "",
        share_image_url: "javascript:alert(1)",
      },
    } as WebsiteV3Page,
    appUrl: "https://app.example.test/",
    routeRestaurantId: "bad slug/with spaces",
  });

  assert.equal(seo.title, "Foody - Order Food Online");
  assert.equal(seo.description, "Order your favorite food online with Foody");
  assert.match(seo.imageUrl, /^https:\/\/app\.example\.test\/api\/og/);
  assert.equal(
    seo.canonicalUrl,
    "https://app.example.test/r/bad%20slug%2Fwith%20spaces",
  );
});
