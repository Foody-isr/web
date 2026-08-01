import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildWebsiteAliasTarget,
  canonicalRootRedirect,
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

function cateringPage(
  overrides: Partial<Extract<WebsiteV3Page, { type: "catering" }>> = {},
): Extract<WebsiteV3Page, { type: "catering" }> {
  return {
    id: 2,
    restaurant_id: 9,
    type: "catering",
    slug: "traiteur",
    title: "Traiteur",
    sort_order: 2,
    nav_visible: true,
    is_default: false,
    seo: {},
    settings: { service_ids: [22] },
    appearance_overrides: {},
    sections: [],
    created_at: "2026-07-30T09:15:00Z",
    updated_at: "2026-07-30T10:30:00Z",
    ...overrides,
  };
}

function defaultCatering(
  overrides: Partial<Extract<WebsiteV3Page, { type: "catering" }>> = {},
): Extract<WebsiteV3Page, { type: "catering" }> {
  return cateringPage({ ...overrides, is_default: true });
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

test("catering alias resolves the default catering page", () => {
  const pages: WebsiteV3Page[] = [
    cateringPage({ slug: "shabbat" }),
    defaultCatering({ slug: "traiteur" }),
  ];

  assert.equal(
    resolveCanonicalWebsitePage(pages, "catering")?.slug,
    "traiteur",
  );
});

test("the internal slug of a default catering page redirects to catering", () => {
  assert.equal(
    canonicalRedirectForPage(defaultCatering({ slug: "traiteur" })),
    "/catering",
  );
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

test("a root without a landing redirects to order", () => {
  assert.equal(canonicalRootRedirect(false, false, false), "/order");
});

test("a catering-only root without a landing redirects to catering", () => {
  assert.equal(canonicalRootRedirect(false, true, true), "/catering");
});
