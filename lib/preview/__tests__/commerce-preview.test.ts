import assert from "node:assert/strict";
import { test } from "node:test";
import { readCommercePreviewDraft } from "../commerceProtocol";
import { commerceSampleLines } from "../commerceSample";
import { lineTotal } from "../../cart";

test("commerce messages preserve resets and the complete draft for all screens", () => {
  const value = readCommercePreviewDraft({ type: "foody-checkout-preview", checkoutConfig: null,
    appearanceOverrides: null, siteConfig: { brand_color: "#123456" }, revision: 3, contentRevision: 2,
    activePageKey: "page-5", device: "mobile" });
  assert.equal(value?.checkoutConfig, null);
  assert.equal(value?.appearanceOverrides, null);
  assert.deepEqual(value?.siteConfig, { brand_color: "#123456" });
  assert.equal(value?.contentRevision, 2);
  assert.equal(value?.activePageKey, "page-5");
});

test("commerce rejects malformed envelopes before acknowledging a preview", () => {
  for (const value of [null, [], {}, { type: "foody-preview-state" }])
    assert.equal(readCommercePreviewDraft(value), null);
  for (const patch of [{ checkoutConfig: [] }, { appearanceOverrides: "red" }, { revision: -1 },
    { contentRevision: NaN }, { device: "tablet" }, { activePageKey: 5 }])
    assert.equal(readCommercePreviewDraft({ type: "foody-checkout-preview", ...patch }), null);
});

test("sample carts are fresh isolated data and localize without changing totals", () => {
  const first = commerceSampleLines("fr");
  first[0].quantity = 99;
  for (const locale of ["fr", "en", "he"]) {
    const lines = commerceSampleLines(locale);
    assert.equal(lines.reduce((sum, line) => sum + lineTotal(line), 0), 65);
    assert.ok(lines.every(line => line.id.startsWith("commerce-preview-")));
  }
  assert.equal(commerceSampleLines("fr")[0].item.name, "Article d’exemple");
  assert.equal(commerceSampleLines("he")[0].item.name, "פריט לדוגמה");
});
