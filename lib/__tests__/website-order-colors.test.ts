import assert from "node:assert/strict";
import { test } from "node:test";
import { orderCardColorVariables, orderNavigationColorVariables, orderFulfillmentColorVariables, woltOrderColorVariables } from "../websiteOrderColors";
import { normalizeWebsiteOrder } from "../websiteOrder";
import { normalizeSiteColors, colorContrast } from "../siteColors";

test("service dialogs inherit the menu or their assigned style, with readable button text", () => {
  const colors = normalizeSiteColors({});
  Object.assign(colors.styles[1], {background: "#df5020", paragraph: "#ffffff", title: "#ffeedd", solid_button: "#24304a"});
  Object.assign(colors.styles[3], {background: "#f4ede0", paragraph: "#223311", title: "#112200", solid_button: "#223311"});
  const palette = {color_styles: colors};
  const inherited = orderFulfillmentColorVariables(palette, normalizeWebsiteOrder({color_style: "style-2"}));
  assert.equal(inherited["--bg-page"], "#df5020");
  assert.ok(colorContrast(inherited["--brand"], inherited["--ink-on-accent"]) >= 4.5);
  const assigned = orderFulfillmentColorVariables(palette, normalizeWebsiteOrder({color_style: "style-2", fulfillment_color_style: "style-4"}));
  assert.equal(assigned["--bg-page"], "#f4ede0");
  assert.equal(assigned["--site-title"], "#112200");
  assert.equal(assigned["--text"], "#223311");
  assert.equal(normalizeWebsiteOrder({fulfillment_color_style: "url(invalid)"}).fulfillmentColorStyle, "default");
});

test("cards use independent global menu roles without rebinding the selected style", () => {
  const card = orderCardColorVariables();
  assert.equal(card["--site-background"], undefined);
  assert.equal(card["--order-card-bg"], "var(--site-menu-card-background)");
  assert.equal(card["--order-card-title"], "var(--site-menu-card-title)");
  assert.equal(card["--order-card-price"], "var(--site-menu-card-price)");
  assert.equal(card["--order-card-description"], "var(--site-menu-card-description)");
});

test("normal and sticky categories use the same independent global surface and pill roles", () => {
  const nav = orderNavigationColorVariables();
  for (const prefix of ["--cat-", "--cat-sticky-", "--cat-current-"]) {
    assert.equal(nav[prefix + "bg"], "var(--site-menu-bar-background)");
    assert.equal(nav[prefix + "pill-bg"], "var(--site-menu-pill-background)");
    assert.equal(nav[prefix + "active-bg"], "var(--site-menu-active-background)");
    assert.equal(nav[prefix + "active-text"], "var(--site-menu-active-text)");
    assert.equal(nav[prefix + "search-text"], "var(--site-menu-category-text)");
  }
  assert.equal(nav["--site-background"], undefined);
  assert.equal(nav["--order-category-active-text"], "var(--site-menu-active-text)");
});

test("the Wolt palette is a page-local opt-in and cannot rewrite shared styles", () => {
  assert.equal(normalizeWebsiteOrder({}).colorPreset, "site");
  assert.equal(normalizeWebsiteOrder({color_preset: "invalid"}).colorPreset, "site");
  assert.equal(normalizeWebsiteOrder({color_preset: "wolt"}).colorPreset, "wolt");
  const colors = woltOrderColorVariables();
  assert.equal(colors["--site-menu-background"], "#000000");
  assert.equal(colors["--site-menu-card-background"], "transparent");
  assert.equal(colors["--site-menu-card-price"], "#009fca");
  assert.equal(colors["--site-menu-active-text"], "#009fca");
  assert.ok(Object.keys(colors).every(key => key.startsWith("--site-menu-")));
});
