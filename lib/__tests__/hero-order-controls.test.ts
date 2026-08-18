import assert from "node:assert/strict";
import { test } from "node:test";
import {
  selectorShapeClass,
  selectorSizeClass,
  selectorStyle,
  selectorVariantClass,
} from "@/components/ModeChip";
import { heroMediaOverlayEnabled } from "@/components/sections/HeroBannerSection";

test("hero media veil can be disabled explicitly", () => {
  assert.equal(heroMediaOverlayEnabled({}), true);
  assert.equal(heroMediaOverlayEnabled({ bg_overlay: true }), true);
  assert.equal(heroMediaOverlayEnabled({ bg_overlay: false }), false);
});

test("order type selector resolves shape, size, variant, and custom colors", () => {
  assert.equal(selectorShapeClass("pill"), "rounded-full");
  assert.equal(selectorShapeClass("rounded"), "rounded-xl");
  assert.equal(selectorShapeClass("square"), "rounded-none");
  assert.match(selectorSizeClass("lg"), /h-14/);
  assert.match(selectorVariantClass("outline"), /border-\[var\(--brand\)\]/);
  assert.deepEqual(
    selectorStyle({
      bg: "#ffffff",
      text_color: "#111827",
      border_color: "#315fce",
    }),
    {
      backgroundColor: "#ffffff",
      color: "#111827",
      borderColor: "#315fce",
    },
  );
});
