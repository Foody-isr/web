import assert from "node:assert/strict";
import { test } from "node:test";
import {
  categoryBarStyle,
  categoryScrollBehavior,
} from "@/components/CategoryTabs";
import {
  footerStyleVariables,
} from "@/components/sections/FooterSection";
import {
  menuHighlightsArrowStyle,
  menuHighlightsStyleVariables,
} from "@/components/sections/MenuHighlightsSection";

test("footer palette resolves section-local semantic variables", () => {
  const variables = footerStyleVariables({
    custom_bg: "#111827",
    custom_text: "#f8fafc",
    custom_muted: "#94a3b8",
    custom_accent: "#d6ff3f",
    custom_divider: "#334155",
  });

  assert.deepEqual(variables, {
    "--footer-bg": "#111827",
    "--footer-text": "#f8fafc",
    "--footer-muted": "#94a3b8",
    "--footer-accent": "#d6ff3f",
    "--footer-divider": "#334155",
  });
});

test("footer palette omits empty settings so legacy presets remain active", () => {
  assert.deepEqual(
    footerStyleVariables({ custom_bg: "", custom_text: undefined }),
    {},
  );
});

test("Menu Highlights palette resolves section and card semantics", () => {
  const variables = menuHighlightsStyleVariables({
    custom_bg: "#ffffff",
    custom_text: "#111827",
    card_bg: "#f8fafc",
    card_text: "#0f172a",
    card_muted: "#64748b",
    price_color: "#be123c",
    accent_color: "#315fce",
  });

  assert.deepEqual(variables, {
    "--highlight-bg": "#ffffff",
    "--highlight-text": "#111827",
    "--highlight-card-bg": "#f8fafc",
    "--highlight-card-text": "#0f172a",
    "--highlight-card-muted": "#64748b",
    "--highlight-price": "#be123c",
    "--highlight-accent": "#315fce",
  });
});

test("category bar keeps one branded palette before and after sticking", () => {
  assert.deepEqual(categoryBarStyle(false), {
    backgroundColor: "var(--cat-sticky-bg, var(--cat-bg, var(--brand-dark)))",
    color: "var(--cat-sticky-text, var(--cat-text, var(--ink-on-accent)))",
    borderColor: "var(--cat-sticky-divider, var(--cat-divider, color-mix(in srgb, var(--cat-current-text) 20%, transparent)))",
    "--cat-current-bg": "var(--cat-sticky-bg, var(--cat-bg, var(--brand-dark)))",
    "--cat-current-text": "var(--cat-sticky-text, var(--cat-text, var(--ink-on-accent)))",
    "--cat-current-accent": "var(--cat-sticky-accent, var(--cat-accent, var(--cat-current-text)))",
    "--cat-current-active-bg": "var(--cat-sticky-active-bg, var(--cat-active-bg, var(--cat-current-text)))",
    "--cat-current-active-text": "var(--cat-sticky-active-text, var(--cat-active-text, var(--cat-current-bg)))",
    "--cat-current-search-bg": "var(--cat-sticky-search-bg, var(--cat-search-bg, color-mix(in srgb, var(--cat-current-text) 12%, transparent)))",
    "--cat-current-search-text": "var(--cat-sticky-search-text, var(--cat-search-text, var(--cat-current-text)))",
    "--cat-current-icon-bg": "var(--cat-sticky-icon-bg, var(--cat-icon-bg, var(--cat-current-text)))",
    "--cat-current-icon": "var(--cat-sticky-icon, var(--cat-icon, var(--cat-current-bg)))",
    "--cat-current-cart-bg": "var(--cat-sticky-cart-bg, var(--cat-cart-bg, var(--cat-current-text)))",
    "--cat-current-cart-text": "var(--cat-sticky-cart-text, var(--cat-cart-text, var(--cat-current-bg)))",
  });
  assert.deepEqual(categoryBarStyle(true), categoryBarStyle(false));
});

test("category auto-scroll disables smooth motion when the user requests it", () => {
  assert.equal(categoryScrollBehavior(false), "smooth");
  assert.equal(categoryScrollBehavior(true), "auto");
});

test("Menu Highlights arrows consume the section accent token", () => {
  assert.deepEqual(menuHighlightsArrowStyle(), {
    color: "var(--highlight-accent, var(--brand))",
  });
});
