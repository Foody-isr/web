// Website Builder v2 — token cascade.
//
// The v2 builder resolves every visual token as a two-axis cascade:
//   Axis 1  Site base → Page override   (a page inherits the site, overrides what it wants)
//   Axis 2  Desktop → Mobile override   (mobile inherits desktop, overrides what it wants)
//
// Both axes are sparse maps of token name → value where later layers win, so a
// page paints the site base unless it explicitly overrides a token, and mobile
// paints the desktop-resolved value unless it overrides again. This pure
// resolver is the single source of truth the render layer AND the live preview
// both feed through, so what the owner sees in the editor is exactly what ships.

export type TokenMap = Record<string, string>;

/**
 * A page's sparse appearance overrides.
 * - `base`   layers over the site base for every device.
 * - `mobile` layers again, only on mobile viewports.
 * Missing/empty means "inherit" — nothing is overridden.
 */
export interface PageAppearance {
  base?: TokenMap | null;
  mobile?: TokenMap | null;
}

export type Device = "desktop" | "mobile";

/**
 * resolvePageTokens merges both cascade axes into the effective token map for
 * one page on one device. Inputs are never mutated.
 */
export function resolvePageTokens(
  siteBase: TokenMap | null | undefined,
  page: PageAppearance | null | undefined,
  device: Device,
): TokenMap {
  const merged: TokenMap = { ...(siteBase ?? {}) };
  if (page?.base) Object.assign(merged, page.base);
  if (device === "mobile" && page?.mobile) Object.assign(merged, page.mobile);
  return merged;
}

/**
 * tokenDiff returns only the entries in `resolved` that differ from `siteBase`
 * — i.e. what a page/device actually overrides. Powers the admin's
 * "hérite / remplacé" chips and lets the renderer emit only the CSS vars that
 * changed rather than the full base every time.
 */
export function tokenDiff(
  siteBase: TokenMap | null | undefined,
  resolved: TokenMap,
): TokenMap {
  const base = siteBase ?? {};
  const out: TokenMap = {};
  for (const [k, v] of Object.entries(resolved)) {
    if (base[k] !== v) out[k] = v;
  }
  return out;
}
