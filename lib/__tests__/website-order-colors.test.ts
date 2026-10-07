import assert from "node:assert/strict";
import { test } from "node:test";
import {
  orderCardColorVariables,
  orderNavigationColorVariables,
} from "../websiteOrderColors";
import { normalizeWebsiteOrder } from "../websiteOrder";

test("cards and category navigation inherit the section style without binding to the global default again", () => {
  const design = normalizeWebsiteOrder({
    card_style: "filled",
    category_shape: "pill",
    card_background: "#6d1f13",
    card_title_color: "#ffffff",
    card_price_color: "#dfc65b",
  });
  const card = orderCardColorVariables(design);
  const nav = orderNavigationColorVariables(design);
  assert.equal(card["--site-background"], undefined);
  assert.equal(nav["--site-background"], undefined);
  assert.equal(card["--order-card-bg"], "var(--site-background)");
  assert.equal(card["--order-card-title"], "var(--site-title)");
  assert.equal(card["--order-card-price"], "var(--site-title)");
  for (const prefix of ["--cat-", "--cat-sticky-", "--cat-current-"]) {
    assert.equal(nav[prefix + "bg"], "var(--site-background)");
    assert.equal(nav[prefix + "active-bg"], "var(--site-solid)");
    assert.equal(nav[prefix + "active-text"], "var(--site-solid-ink)");
    assert.equal(nav[prefix + "search-text"], "var(--site-paragraph)");
  }
  assert.doesNotMatch(
    JSON.stringify({ card, nav }),
    /#6d1f13|#ffffff|#dfc65b|type-item|brand-dark/,
  );
});

test("bounded child choices remain live references to the site's six styles, including accent prices", () => {
  const design = normalizeWebsiteOrder({
    card_style: "filled",
    card_color_style: "style-4",
    category_color_style: "style-5",
    price_color_role: "accent",
  });
  const card = orderCardColorVariables(design),
    nav = orderNavigationColorVariables(design);
  assert.equal(card["--site-background"], "var(--style-4-background)");
  assert.equal(card["--site-title"], "var(--style-4-title)");
  assert.equal(card["--order-card-price"], "var(--site-solid)");
  assert.equal(nav["--site-background"], "var(--style-5-background)");
  const invalid = normalizeWebsiteOrder({
    card_color_style: "custom",
    category_color_style: "url(evil)",
    price_color_role: "#ffffff",
  });
  assert.equal(invalid.cardColorStyle, "default");
  assert.equal(invalid.categoryColorStyle, "default");
  assert.equal(invalid.priceColorRole, "title");
});
