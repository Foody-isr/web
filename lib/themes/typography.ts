// Per-role typography overrides for the menu/order page, layered on top of the
// selected pairing. The overrides are an opaque JSON blob on WebsiteConfig
// (camelCase keys, written by the admin builder and read here verbatim — the
// server never inspects its internals).
//
// Each role maps to a small set of CSS custom properties that the themed
// components read with fallbacks, so an absent override renders pixel-identical
// to today:
//   --type-scale                  overall size multiplier (unitless)
//   --type-<role>-family          font-family for that role
//   --type-<role>-size-mult       per-role size multiplier (unitless)
//
// Effective size = base * --type-scale * --type-<role>-size-mult, so the
// overall scale and the per-role tweak compose. The component supplies `base`
// (its current value) as the calc fallback chain's anchor.

export type TypeRoleKey = "categoryTitle" | "itemName" | "itemPrice" | "itemDescription";

export const TYPE_ROLE_KEYS: TypeRoleKey[] = ["categoryTitle", "itemName", "itemPrice", "itemDescription"];

export type TypographyRoleOverride = {
  /** Font family (must be a loaded family — curated or custom). Empty = inherit pairing. */
  font?: string;
  /** Size multiplier relative to the role's base size. 1 = unchanged. */
  sizeMult?: number;
};

/** A Google Fonts family the restaurant picked beyond the curated list (the
 *  admin font picker persists it automatically). Weights are stored so we can
 *  load the real axes — the css2 fallback for unknown families only fetches
 *  weight 400. */
export type ExtraFont = {
  family: string;
  category: string;
  weights: number[];
  supportsHebrew: boolean;
};

export type TypographyOverrides = {
  /** Overall menu text size multiplier. 1 = unchanged. */
  sizeScale?: number;
  roles?: Partial<Record<TypeRoleKey, TypographyRoleOverride>>;
  /** Non-curated Google Fonts referenced by roles or the hero name font. */
  extraFonts?: ExtraFont[];
};

/** CSS-var slug for a role (lowercased, no separators): "itemName" → "itemname". */
export function roleVarSlug(role: TypeRoleKey): string {
  return role.toLowerCase();
}

/** font-family value for a role. Falls back to the pairing's display/body font,
 *  or to `inherit` when the element should keep whatever font it currently
 *  inherits unless the owner overrides it. */
export function roleFontFamily(
  role: TypeRoleKey,
  family: "display" | "body" | "inherit" = "display",
): string {
  const fallback = family === "inherit" ? "inherit" : `var(--font-${family})`;
  return `var(--type-${roleVarSlug(role)}-family, ${fallback})`;
}

/** Inline style binding a themed text element to a typography role. `baseSize`
 *  is the element's current size (e.g. "1.125rem" or "var(--type-display-lg-size, 2.25rem)");
 *  it is preserved when nothing is overridden. */
export function roleTextStyle(
  role: TypeRoleKey,
  baseSize: string,
  family: "display" | "body" | "inherit" = "display",
): { fontFamily: string; fontSize: string } {
  const r = roleVarSlug(role);
  return {
    fontFamily: roleFontFamily(role, family),
    fontSize: `calc((${baseSize}) * var(--type-scale, 1) * var(--type-${r}-size-mult, 1))`,
  };
}

/** Distinct font families referenced by overrides (for dynamic loading). */
export function typographyFontFamilies(t?: TypographyOverrides | null): string[] {
  if (!t?.roles) return [];
  const out = new Set<string>();
  for (const k of TYPE_ROLE_KEYS) {
    const f = t.roles[k]?.font;
    if (f) out.add(f);
  }
  return [...out];
}
