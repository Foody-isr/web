import assert from "node:assert/strict";
import { test } from "node:test";
import type { WebsiteV3Page } from "../websiteV3Api";
import { redirectDefaultWebsitePagePermanently } from "../websiteV3PermanentRedirect";

function orderPage(isDefault: boolean): Extract<WebsiteV3Page, { type: "order" }> {
  return {
    id: 1,
    restaurant_id: 9,
    type: "order",
    slug: "menu-interne",
    title: "Commander",
    sort_order: 1,
    nav_visible: true,
    is_homepage: false,
    is_default: isDefault,
    seo: {},
    settings: { menu_ids: [11] },
    appearance_overrides: {},
    sections: [],
    created_at: "2026-07-30T09:15:00Z",
    updated_at: "2026-07-30T10:30:00Z",
  };
}

test("an internal default slug permanently redirects with every query value", () => {
  assert.throws(
    () =>
      redirectDefaultWebsitePagePermanently(orderPage(true), "demo", {
        type: "delivery",
        filter: ["vegetarian", "kosher"],
      }),
    (error: unknown) => {
      assert.equal(
        (error as { digest?: string }).digest,
        "NEXT_REDIRECT;replace;/r/demo/order?type=delivery&filter=vegetarian&filter=kosher;308;",
      );
      return true;
    },
  );
});

test("an additional commerce page does not redirect", () => {
  assert.equal(
    redirectDefaultWebsitePagePermanently(orderPage(false), "demo", {}),
    false,
  );
});
