import { siteColorReference } from "./siteColors";
import type { WebsiteOrderDesign } from "./websiteOrder";

/** Child defaults inherit their menu section; explicit choices reuse a global style. */
function childStyle(id: string): Record<string, string> {
  return id === "default" ? {} : siteColorReference(id);
}

/** Shared styles own all card colors; legacy hex and typography colors cannot override them. */
export function orderCardColorVariables(
  design: WebsiteOrderDesign,
): Record<string, string> {
  return {
    ...childStyle(design.cardColorStyle),
    "--order-card-bg":
      design.cardStyle === "filled" ? "var(--site-background)" : "transparent",
    "--order-card-title": "var(--site-title)",
    "--order-card-description": "var(--site-paragraph)",
    "--order-description-opacity": "1",
    "--order-card-price":
      design.priceColorRole === "accent"
        ? "var(--site-solid)"
        : "var(--site-title)",
    "--order-card-border": "var(--site-outline)",
    color: "var(--site-paragraph)",
  };
}

/** Normal and sticky navigation resolve the same shared style, including pills and search. */
export function orderNavigationColorVariables(
  design: WebsiteOrderDesign,
): Record<string, string> {
  const roles = {
    bg: "var(--site-background)",
    text: "var(--site-paragraph)",
    "pill-bg": "transparent",
    "active-bg":
      design.categoryShape === "plain" ? "transparent" : "var(--site-solid)",
    "active-text":
      design.categoryShape === "plain"
        ? "var(--site-title)"
        : "var(--site-solid-ink)",
    "search-bg":
      "color-mix(in srgb, var(--site-paragraph) 12%, var(--site-background))",
    "search-text": "var(--site-paragraph)",
    accent: "var(--site-outline)",
    divider: "var(--site-outline)",
    "icon-bg": "var(--site-solid)",
    icon: "var(--site-solid-ink)",
    "cart-bg": "var(--site-solid)",
    "cart-text": "var(--site-solid-ink)",
  };
  return {
    ...childStyle(design.categoryColorStyle),
    ...Object.fromEntries(
      Object.entries(roles).flatMap(([role, value]) =>
        ["--cat-", "--cat-sticky-", "--cat-current-"].map((prefix) => [
          prefix + role,
          value,
        ]),
      ),
    ),
    "--surface-subtle": roles["search-bg"],
    backgroundColor: "var(--site-background)",
    color: "var(--site-paragraph)",
  };
}
