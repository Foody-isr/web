import assert from "node:assert/strict";
import { test } from "node:test";
import { orderCardColorVariables, orderNavigationColorVariables } from "../websiteOrderColors";

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
});
