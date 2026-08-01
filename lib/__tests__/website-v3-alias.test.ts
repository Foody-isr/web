import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildWebsiteAliasTarget,
  canonicalRedirectForPage,
  resolveCanonicalWebsitePage,
  type WebsiteV3Page,
} from "../websiteV3Api";

function orderPage(
  overrides: Partial<Extract<WebsiteV3Page, { type: "order" }>> = {},
): Extract<WebsiteV3Page, { type: "order" }> {
  return {
    id: 1,
    restaurant_id: 9,
    type: "order",
    slug: "commander",
    title: "Commander",
    sort_order: 1,
    nav_visible: true,
    is_default: false,
    seo: {},
    settings: { menu_ids: [11] },
    appearance_overrides: {},
    sections: [],
    created_at: "2026-07-30T09:15:00Z",
    updated_at: "2026-07-30T10:30:00Z",
    ...overrides,
  };
}

function defaultOrder(
  overrides: Partial<Extract<WebsiteV3Page, { type: "order" }>> = {},
): Extract<WebsiteV3Page, { type: "order" }> {
  return orderPage({ ...overrides, is_default: true });
}

test("website v3 alias preserves the complete query string", () => {
  assert.equal(
    buildWebsiteAliasTarget("demo", "commande-midi", {
      type: "delivery",
      item: "42",
      lang: "fr",
    }),
    "/r/demo/commande-midi?type=delivery&item=42&lang=fr",
  );
});

test("website v3 alias preserves repeated query parameters", () => {
  assert.equal(
    buildWebsiteAliasTarget("demo", "traiteur", {
      filter: ["vegetarian", "kosher"],
      preview: undefined,
    }),
    "/r/demo/traiteur?filter=vegetarian&filter=kosher",
  );
});

test("order alias resolves the default order page", () => {
  const pages: WebsiteV3Page[] = [
    orderPage({ slug: "shabbat" }),
    defaultOrder({ slug: "menu" }),
  ];

  assert.equal(resolveCanonicalWebsitePage(pages, "order")?.slug, "menu");
});

test("the internal slug of a default order page redirects to order", () => {
  assert.equal(canonicalRedirectForPage(defaultOrder({ slug: "menu" })), "/order");
});

test("an additional order page keeps its own public slug", () => {
  assert.equal(canonicalRedirectForPage(orderPage({ slug: "shabbat" })), null);
});

test("a feature card linked to commander never bounces through catering", () => {
  assert.equal(canonicalRedirectForPage(orderPage({ slug: "commander" })), null);
  assert.equal(
    canonicalRedirectForPage(defaultOrder({ slug: "commander" })),
    "/order",
  );
});
