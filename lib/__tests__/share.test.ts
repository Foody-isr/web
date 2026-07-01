import { test } from "node:test";
import assert from "node:assert/strict";
import { toLocale, buildItemShareText, buildItemShareUrl } from "../share";

test("toLocale accepts supported locales and defaults to en", () => {
  assert.equal(toLocale("fr"), "fr");
  assert.equal(toLocale("he"), "he");
  assert.equal(toLocale("en"), "en");
  assert.equal(toLocale("de"), "en");
  assert.equal(toLocale(null), "en");
  assert.equal(toLocale(undefined), "en");
});

test("buildItemShareText interpolates item and restaurant per locale", () => {
  assert.equal(
    buildItemShareText("en", "Tuna Salad", "Mamie Tlv"),
    "Look at this Tuna Salad at Mamie Tlv",
  );
  assert.equal(
    buildItemShareText("fr", "Salade Tuna", "Mamie Tlv"),
    "Regarde Salade Tuna chez Mamie Tlv",
  );
  // Hebrew template includes both values
  const he = buildItemShareText("he", "סלט טונה", "Mamie Tlv");
  assert.ok(he.includes("סלט טונה"));
  assert.ok(he.includes("Mamie Tlv"));
});

test("buildItemShareText contains no em dash", () => {
  for (const loc of ["en", "fr", "he"] as const) {
    assert.ok(!buildItemShareText(loc, "X", "Y").includes("—"));
  }
});

test("buildItemShareUrl appends only item and lang to current path", () => {
  assert.equal(
    buildItemShareUrl("https://app.foody-pos.co.il", "/r/lori-cash/order", "42", "fr"),
    "https://app.foody-pos.co.il/r/lori-cash/order?item=42&lang=fr",
  );
});

test("buildItemShareUrl drops any pre-existing query on the path", () => {
  const out = buildItemShareUrl("https://mamietlv.co.il", "/order", "7", "he");
  const u = new URL(out);
  assert.equal(u.origin, "https://mamietlv.co.il");
  assert.equal(u.pathname, "/order");
  assert.equal(u.searchParams.get("item"), "7");
  assert.equal(u.searchParams.get("lang"), "he");
  assert.equal([...u.searchParams.keys()].length, 2);
});
