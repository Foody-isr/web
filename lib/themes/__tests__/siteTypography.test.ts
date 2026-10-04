import { test } from "node:test";
import assert from "node:assert/strict";
import { typographyFontFamilies } from "../typography";

test("site fonts load even when no menu role is overridden", () => {
  assert.deepEqual(typographyFontFamilies({ site: { headingFont: "Dela Gothic One", bodyFont: "Manrope" } }), ["Dela Gothic One", "Manrope"]);
});

test("site and commerce typography share one font-loading list without dropping role fonts", () => {
  assert.deepEqual(typographyFontFamilies({ site: { headingFont: "Manrope", bodyFont: "Manrope" }, roles: { itemName: { font: "Heebo" }, itemPrice: { font: "Manrope" } } }), ["Manrope", "Heebo"]);
});

test("older themes without site typography remain valid", () => {
  assert.deepEqual(typographyFontFamilies(), []);
  assert.deepEqual(typographyFontFamilies({ roles: { itemPrice: { font: "Inter" } } }), ["Inter"]);
});
