import assert from "node:assert/strict";
import { test } from "node:test";
import {
  selectorShapeClass,
  selectorSizeClass,
  selectorStyle,
  selectorVariantClass,
} from "@/components/ModeChip";
import { heroMediaOverlayEnabled } from "@/components/sections/HeroBannerSection";
import {
  featureCardButtonShapeClass,
  featureCardButtonStyle,
} from "@/components/sections/FeatureCardsSection";

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

test("feature card buttons resolve shape and custom colors", () => {
  assert.equal(featureCardButtonShapeClass("pill"), "rounded-full");
  assert.equal(featureCardButtonShapeClass("rounded"), "rounded-xl");
  assert.equal(featureCardButtonShapeClass("square"), "rounded-none");
  assert.deepEqual(
    featureCardButtonStyle({
      button_bg_color: "#7c2d12",
      button_text_color: "#fef3c7",
      button_border_color: "#f59e0b",
    }),
    {
      backgroundColor: "#7c2d12",
      color: "#fef3c7",
      borderColor: "#f59e0b",
    },
  );
});

test("feature card buttons preserve the legacy appearance by default", () => {
  assert.deepEqual(featureCardButtonStyle({}), {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    color: "var(--text, #111)",
  });
});
