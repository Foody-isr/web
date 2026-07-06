import type { ResolvedTheme } from "./types";
import { contrastInk } from "./contrastInk";
import { fontUrlsForPairing } from "./fontUrls";
import { googleFontUrl, injectFontFace } from "./curatedFonts";
import {
  TYPE_ROLE_KEYS,
  roleVarSlug,
  typographyFontFamilies,
  type TypographyOverrides,
} from "./typography";

const LOADED_FONT_URLS = new Set<string>();

// CSS custom properties owned by the typography-overrides layer. Listed so we
// can reset them on every apply (overrides are sparse — clearing first avoids a
// stale var lingering when the admin removes a customization mid-preview).
const TYPE_OVERRIDE_VAR_NAMES = [
  "--type-scale",
  ...TYPE_ROLE_KEYS.flatMap((r) => [
    `--type-${roleVarSlug(r)}-family`,
    `--type-${roleVarSlug(r)}-size-mult`,
    `--type-${roleVarSlug(r)}-weight`,
    `--type-${roleVarSlug(r)}-transform`,
  ]),
];

function loadFontFamily(family: string, extraWeights?: number[]): void {
  const url = googleFontUrl(family, extraWeights);
  if (LOADED_FONT_URLS.has(url)) return;
  LOADED_FONT_URLS.add(url);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = url;
  document.head.appendChild(link);
}

function applyTypography(root: HTMLElement, t: TypographyOverrides | null | undefined): void {
  for (const name of TYPE_OVERRIDE_VAR_NAMES) root.style.removeProperty(name);
  if (!t) return;

  if (typeof t.sizeScale === "number" && t.sizeScale > 0 && t.sizeScale !== 1) {
    root.style.setProperty("--type-scale", String(t.sizeScale));
  }
  for (const role of TYPE_ROLE_KEYS) {
    const o = t.roles?.[role];
    if (!o) continue;
    const slug = roleVarSlug(role);
    if (o.font) root.style.setProperty(`--type-${slug}-family`, `"${o.font}"`);
    if (typeof o.sizeMult === "number" && o.sizeMult > 0 && o.sizeMult !== 1) {
      root.style.setProperty(`--type-${slug}-size-mult`, String(o.sizeMult));
    }
    if (typeof o.weight === "number" && o.weight >= 100 && o.weight <= 900) {
      root.style.setProperty(`--type-${slug}-weight`, String(o.weight));
    }
    if (o.transform === "uppercase" || o.transform === "none") {
      root.style.setProperty(`--type-${slug}-transform`, o.transform);
    }
  }
  const extras = new Map((t.extraFonts ?? []).map((f) => [f.family, f]));
  for (const family of typographyFontFamilies(t)) {
    const ef = extras.get(family);
    // Custom (uploaded) fonts load via @font-face; Google Fonts via css2 link.
    if (ef?.url || ef?.faces?.length) injectFontFace(family, { url: ef.url, format: ef.format, faces: ef.faces });
    else loadFontFamily(family, ef?.weights);
  }
}

function hexToRgbTriple(hex: string): string {
  let c = hex.replace("#", "");
  if (c.length === 3) c = c.split("").map(ch => ch + ch).join("");
  if (c.length === 8) c = c.slice(0, 6);
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

export function shade(hex: string, amount: number): string {
  // amount in [-1, 1] — negative darkens, positive lightens.
  let c = hex.replace("#", "");
  if (c.length === 3) c = c.split("").map(ch => ch + ch).join("");
  if (c.length === 8) c = c.slice(0, 6);
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const apply = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v + (amount > 0 ? (255 - v) * amount : v * amount))));
  const toHex = (v: number) => apply(v).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Keys legacy components (OrderExperience, MenuItemCard, TopBar,
// RestaurantHero, CartDrawer, etc.) read directly via var(--…). The new
// theme tokens drive these so theme switching works without rewriting
// each component to consume the themed primitives.
type LegacyVarMap = Record<string, string>;

function legacyVarsFromTheme(rt: ResolvedTheme): LegacyVarMap {
  const c = rt.theme.tokens.colors;
  const accent = rt.brandColorOverride ?? c.accent;
  const accentInk = rt.brandColorOverride ? contrastInk(rt.brandColorOverride) : c.accentInk;
  return {
    // Brand / accent → derived from theme accent + override.
    "--brand": accent,
    "--brand-rgb": hexToRgbTriple(accent),
    "--brand-dark": shade(accent, -0.18),
    "--brand-light": shade(accent, 0.32),
    "--price": accent,
    // Text colors.
    "--text": c.ink,
    "--text-muted": c.inkMuted,
    "--text-soft": c.inkSoft,
    "--ink-on-accent": accentInk,
    // Surfaces.
    "--surface": c.surface,
    "--surface-subtle": c.surfaceMuted,
    "--surface-elevated": shade(c.surface, rt.theme.mode === "dark" ? 0.08 : -0.03),
    "--bg-page": c.bg,
    "--bg-muted": c.surfaceMuted,
    "--divider": c.divider,
    // Status (legacy callers use these names).
    "--success": c.success,
    "--warning": c.warning,
    "--error": c.error,
  };
}

export function applyTheme(rt: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  root.setAttribute("data-theme", rt.themeId);
  root.setAttribute("data-pairing", rt.pairingId);
  root.setAttribute("dir", rt.direction);

  // Color-scheme drives form controls / scrollbars.
  root.style.setProperty("color-scheme", rt.theme.mode);

  if (rt.brandColorOverride) {
    const ink = contrastInk(rt.brandColorOverride);
    root.style.setProperty("--accent", rt.brandColorOverride);
    root.style.setProperty("--accent-rgb", hexToRgbTriple(rt.brandColorOverride));
    root.style.setProperty("--accent-ink", ink);
    root.style.setProperty("--accent-ink-rgb", hexToRgbTriple(ink));
  } else {
    root.style.removeProperty("--accent");
    root.style.removeProperty("--accent-rgb");
    root.style.removeProperty("--accent-ink");
    root.style.removeProperty("--accent-ink-rgb");
  }

  // Bridge to legacy var names so existing components react to theme.
  const legacy = legacyVarsFromTheme(rt);
  for (const [name, value] of Object.entries(legacy)) {
    root.style.setProperty(name, value);
  }

  root.style.setProperty("--font-display", `"${rt.fonts.display}"`);
  root.style.setProperty("--font-body", `"${rt.fonts.body}"`);

  applyTypography(root, rt.typography);

  for (const url of fontUrlsForPairing(rt.pairing)) {
    if (LOADED_FONT_URLS.has(url)) continue;
    LOADED_FONT_URLS.add(url);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    document.head.appendChild(link);
  }
}

const LEGACY_VAR_NAMES = [
  "--brand", "--brand-rgb", "--brand-dark", "--brand-light", "--price",
  "--text", "--text-muted", "--text-soft", "--ink-on-accent",
  "--surface", "--surface-subtle", "--surface-elevated",
  "--bg-page", "--bg-muted", "--divider",
  "--success", "--warning", "--error",
];

export function clearTheme(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.removeAttribute("data-theme");
  root.removeAttribute("data-pairing");
  for (const prop of [
    "--accent", "--accent-rgb", "--accent-ink", "--accent-ink-rgb",
    "--font-display", "--font-body",
    ...TYPE_OVERRIDE_VAR_NAMES,
    ...LEGACY_VAR_NAMES,
  ]) {
    root.style.removeProperty(prop);
  }
  root.style.removeProperty("color-scheme");
}

// ── Per-section color overrides ──────────────────────────────────────────────
// Scoped CSS vars consumed by the navbar, hero, metadata row and category bar,
// each with a fallback to its global token (e.g. var(--cat-bg, var(--surface))).
// We only set a var when the admin provides an override, so an unset section is
// pixel-identical to the global theme.

/** Minimal structural shape — kept local to avoid a types import cycle. */
type SectionColorsInput = {
  navbar?: { bg?: string; text?: string } | null;
  hero?: { bg?: string; text?: string } | null;
  metadata?: { bg?: string; text?: string } | null;
  categoryBar?: { bg?: string; text?: string; accent?: string } | null;
} | null | undefined;

const SECTION_VAR_NAMES = [
  "--navbar-bg", "--navbar-text",
  "--hero-bg", "--hero-text",
  "--meta-bg", "--meta-text",
  "--cat-bg", "--cat-text", "--cat-accent",
];

export function applySectionColors(sc: SectionColorsInput): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const set = (name: string, val?: string) => {
    if (val) root.style.setProperty(name, val);
    else root.style.removeProperty(name);
  };
  set("--navbar-bg", sc?.navbar?.bg);
  set("--navbar-text", sc?.navbar?.text);
  set("--hero-bg", sc?.hero?.bg);
  set("--hero-text", sc?.hero?.text);
  set("--meta-bg", sc?.metadata?.bg);
  set("--meta-text", sc?.metadata?.text);
  set("--cat-bg", sc?.categoryBar?.bg);
  set("--cat-text", sc?.categoryBar?.text);
  set("--cat-accent", sc?.categoryBar?.accent);
}

export function clearSectionColors(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const prop of SECTION_VAR_NAMES) root.style.removeProperty(prop);
}
