import type { ResolvedTheme } from "./types";
import { contrastInk } from "./contrastInk";
import { fontUrlsForPairing } from "./fontUrls";

const LOADED_FONT_URLS = new Set<string>();

function hexToRgbTriple(hex: string): string {
  let c = hex.replace("#", "");
  if (c.length === 3) c = c.split("").map(ch => ch + ch).join("");
  if (c.length === 8) c = c.slice(0, 6);
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

function shade(hex: string, amount: number): string {
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
    ...LEGACY_VAR_NAMES,
  ]) {
    root.style.removeProperty(prop);
  }
  root.style.removeProperty("color-scheme");
}
