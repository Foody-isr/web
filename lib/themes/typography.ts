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
//   --type-<role>-weight          font-weight for that role (100-900)
//   --type-<role>-transform       text-transform ("uppercase" | "none")
//
// Effective size = base * --type-scale * --type-<role>-size-mult, so the
// overall scale and the per-role tweak compose. The component supplies `base`
// (its current value) as the calc fallback chain's anchor, and its current
// weight as the weight var's fallback.

import type { CSSProperties } from "react";

export type TypeRoleKey = "categoryTitle" | "itemName" | "itemPrice" | "itemDescription";

export const TYPE_ROLE_KEYS: TypeRoleKey[] = ["categoryTitle", "itemName", "itemPrice", "itemDescription"];

export type TypographyRoleOverride = {
  /** Font family (must be a loaded family — curated or custom). Empty = inherit pairing. */
  font?: string;
  /** Size multiplier relative to the role's base size. 1 = unchanged. */
  sizeMult?: number;
  /** Font weight (100-900). Absent = keep the component's own weight. */
  weight?: number;
  /** Text case. Absent = Auto (keep the theme's behavior, e.g. capitalizeBanners). */
  transform?: "uppercase" | "none";
};

/** One uploaded font file = one @font-face at a weight/style (mirrors admin). */
export type FontFace = {
  url: string;
  format?: string;
  weight?: number;
  style?: "normal" | "italic";
};

/** A font the restaurant added beyond the curated list. Three kinds share this
 *  shape (the admin font picker persists all automatically):
 *   - Google Fonts (no `url`/`faces`): weights are stored so we can load the
 *     real axes — the css2 fallback for unknown families only fetches 400.
 *   - Single-file custom fonts (`url` set, `category: 'custom'`): one uploaded
 *     file loaded via @font-face from S3 instead of Google Fonts.
 *   - Multi-variant custom fonts (`faces` set): several uploaded files under one
 *     family, each an @font-face at its own weight/style.
 *  Presence of `url` or `faces` marks a custom (uploaded) font. */
export type ExtraFont = {
  family: string;
  category: string;
  weights: number[];
  supportsHebrew: boolean;
  /** Single-file custom source (S3); `faces` supersedes it for multi-variant. */
  url?: string;
  /** CSS @font-face format() hint for the single-file `url`. */
  format?: string;
  /** Multi-variant custom faces — one uploaded file per weight/style. */
  faces?: FontFace[];
};

export type TypographyOverrides = {
  /** Overall menu text size multiplier. 1 = unchanged. */
  sizeScale?: number;
  roles?: Partial<Record<TypeRoleKey, TypographyRoleOverride>>;
  /** Non-curated Google Fonts referenced by roles or the hero name font. */
  extraFonts?: ExtraFont[];
  /** Font weight for the hero restaurant name. Absent = hero's own weight. */
  heroWeight?: number;
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
 *  it is preserved when nothing is overridden. `baseWeight` is the element's
 *  current font-weight (the value its own classes would apply) — required as
 *  an explicit fallback because the inline style outranks those classes. When
 *  omitted, font-weight is left to the element's classes and the per-role
 *  weight override does not apply. Same contract for `baseTransform`: the
 *  element's current text case (banners derive it from capitalizeBanners);
 *  when omitted, the per-role case override does not apply. */
export type RoleTextStyle = {
  fontFamily: string;
  fontSize: string;
  fontWeight?: string;
  textTransform?: CSSProperties["textTransform"];
};

export function roleTextStyle(
  role: TypeRoleKey,
  baseSize: string,
  family: "display" | "body" | "inherit" = "display",
  baseWeight?: number | string,
  baseTransform?: "uppercase" | "none",
): RoleTextStyle {
  const r = roleVarSlug(role);
  const style: RoleTextStyle = {
    fontFamily: roleFontFamily(role, family),
    fontSize: `calc((${baseSize}) * var(--type-scale, 1) * var(--type-${r}-size-mult, 1))`,
  };
  if (baseWeight !== undefined) {
    style.fontWeight = `var(--type-${r}-weight, ${baseWeight})`;
  }
  if (baseTransform !== undefined) {
    // csstype has no string catch-all for text-transform; the var() is valid CSS.
    style.textTransform = `var(--type-${r}-transform, ${baseTransform})` as CSSProperties["textTransform"];
  }
  return style;
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
