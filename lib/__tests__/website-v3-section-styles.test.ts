import assert from "node:assert/strict";
import { test } from "node:test";
import { categoryBarStyle } from "@/components/CategoryTabs";
import {
  footerStyleVariables,
} from "@/components/sections/FooterSection";
import {
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

test("category bar uses normal tokens before sticking and sticky tokens after", () => {
  assert.deepEqual(categoryBarStyle(false), {
    backgroundColor: "var(--cat-bg, var(--bg-page))",
    color: "var(--cat-text, var(--text))",
    borderColor: "var(--cat-divider, transparent)",
    "--cat-current-text": "var(--cat-text, var(--text))",
    "--cat-current-accent": "var(--cat-accent, var(--brand))",
  });
  assert.deepEqual(categoryBarStyle(true), {
    backgroundColor: "var(--cat-sticky-bg, var(--cat-bg, var(--surface)))",
    color: "var(--cat-sticky-text, var(--cat-text, var(--text)))",
    borderColor:
      "var(--cat-sticky-divider, var(--cat-divider, var(--divider)))",
    "--cat-current-text":
      "var(--cat-sticky-text, var(--cat-text, var(--text)))",
    "--cat-current-accent":
      "var(--cat-sticky-accent, var(--cat-accent, var(--brand)))",
  });
});
