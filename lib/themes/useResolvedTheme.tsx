"use client";

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { themesById, pairingsById } from "./generated/themes";
import { applyTheme, clearTheme, applySectionColors, clearSectionColors, shade } from "./applyTheme";
import { contrastInk } from "./contrastInk";
import { pickFont } from "./pickFont";
import type { ResolvedTheme, Direction, PreviewMessage, RestaurantPreview } from "./types";
import type { WebsiteConfig } from "@/lib/types";

type CustomPalette = NonNullable<WebsiteConfig["customPalette"]>;

// buildCustomTheme synthesizes a Theme shaped like a catalog entry from the
// 4 user-supplied swatches. The 8 derived color tokens are computed; radius
// /spacing/shadow are cloned from a sensible default theme so layout stays
// consistent with what users expect from the preset that matches their mode.
function buildCustomTheme(p: CustomPalette): typeof themesById[string] {
  const isDark = p.mode === "dark";
  const base = isDark ? themesById["editorial-dark"] : themesById["coastal-sand"];
  const surfaceMuted = shade(p.surface, isDark ? 0.04 : -0.04);
  const menuText = p.menuText || p.ink;
  return {
    ...base,
    id: "custom",
    name: "Custom",
    mode: p.mode,
    tokens: {
      ...base.tokens,
      colors: {
        bg: p.bg,
        surface: p.surface,
        surfaceMuted,
        // Search field fill: an explicit swatch, else the muted surface.
        searchBg: p.searchBg || surfaceMuted,
        ink: p.ink,
        inkMuted: shade(p.ink, isDark ? -0.18 : 0.36),
        inkSoft: shade(p.ink, isDark ? -0.36 : 0.55),
        divider: hexToRgba(p.ink, 0.14),
        // Category-banner text: an explicit swatch, else inherit the body ink.
        categoryInk: p.categoryInk || p.ink,
        // Item/combo detail-modal text tiers: an explicit swatch, else body ink.
        menuText,
        menuTextMuted: shade(menuText, isDark ? -0.18 : 0.36),
        menuTextSoft: shade(menuText, isDark ? -0.36 : 0.55),
        accent: p.accent,
        accentInk: contrastInk(p.accent),
        success: isDark ? "#88B26A" : "#3A8050",
        warning: isDark ? "#E8B33A" : "#B07A12",
        error: isDark ? "#D86846" : "#B33E1F",
      },
    },
  };
}

function hexToRgba(hex: string, alpha: number): string {
  let c = hex.replace("#", "");
  if (c.length === 3) c = c.split("").map((ch) => ch + ch).join("");
  if (c.length === 8) c = c.slice(0, 6);
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// The theme system targets the menu/order experience only — landing page
// (RestaurantLanding at /r/<slug>) keeps its own legacy styling per spec
// §1.1. We apply CSS vars only on these routes.
//
// Custom domains (e.g. mamietlv.co.il) get their /r/<slug>/ prefix stripped
// at the edge, so usePathname() returns the public path without it. Match
// both forms or themed pages render with light :root defaults on those hosts.
const ORDER_ROUTE_RE =
  /(?:\/r\/[^/]+\/(?:order(?:\/|$|\?)|orders(?:\/|$|\?)|stories(?:\/|$|\?)|table(?:\/|$|\?)|tournee(?:\/|$|\?)|catering(?:\/|$|\?)|t\/))|(?:^\/order(?:\/|$|\?))|(?:^\/orders(?:\/|$|\?))|(?:^\/stories(?:\/|$|\?))|(?:^\/table(?:\/|$|\?))|(?:^\/tournee(?:\/|$|\?))|(?:^\/catering(?:\/|$|\?))|(?:^\/t\/)/;
export function isOrderRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return ORDER_ROUTE_RE.test(pathname);
}

type Ctx = {
  resolved: ResolvedTheme | null;
  config: WebsiteConfig | null;
  restaurantPreview: RestaurantPreview | null;
};
const ResolvedThemeContext = createContext<Ctx>({ resolved: null, config: null, restaurantPreview: null });

export const useResolvedTheme = () => useContext(ResolvedThemeContext);

function resolve(
  themeId: string,
  pairingId: string,
  brandOverride: string | null,
  customPalette: WebsiteConfig["customPalette"],
  direction: Direction,
  typography: WebsiteConfig["typography"],
): ResolvedTheme | null {
  const pairing = pairingsById[pairingId] ?? pairingsById["modern-sans"];
  // "custom" is a sentinel id, not a catalog entry. We build a synthetic
  // theme from the saved palette; missing palette falls back to editorial-dark
  // so the page still renders if validation slipped through.
  const isCustom = themeId === "custom" && !!customPalette;
  const theme = isCustom
    ? buildCustomTheme(customPalette!)
    : (themesById[themeId] ?? themesById["editorial-dark"]);
  if (!theme || !pairing) return null;
  return {
    themeId: theme.id,
    pairingId: pairing.id,
    theme,
    pairing,
    // When a custom palette is active, brand_color override is ignored —
    // the palette already owns the accent (spec §5.5).
    brandColorOverride: isCustom ? null : brandOverride,
    direction,
    fonts: {
      display: pickFont(pairing, "display", direction),
      body: pickFont(pairing, "body", direction),
    },
    layout: theme.layout,
    typography: typography ?? null,
  };
}

type Props = { config: WebsiteConfig | null; direction?: Direction; children: ReactNode };

export function ResolvedThemeProvider({ config, direction = "ltr", children }: Props) {
  const pathname = usePathname();
  const onOrderRoute = isOrderRoute(pathname);

  // Override holds whatever fields the admin has changed via postMessage.
  // Merged on top of the saved `config` so every consumer of the context
  // (TopBar reads logoSize/hideNavbarName, OrderExperience reads
  // layoutDefault, etc.) reacts live to the admin's edits.
  const [override, setOverride] = useState<Partial<WebsiteConfig> | null>(null);
  // Restaurant-level visual edits (logo, cover) ride alongside the config
  // override in the same preview message but apply to the Restaurant, not the
  // WebsiteConfig — kept separate so RestaurantHero can layer them over its
  // restaurant prop.
  const [restaurantPreview, setRestaurantPreview] = useState<RestaurantPreview | null>(null);

  const effectiveConfig = useMemo<WebsiteConfig | null>(() => {
    if (!override) return config;
    if (!config) return override as WebsiteConfig;
    return { ...config, ...override };
  }, [config, override]);

  const resolved = useMemo(() => {
    const cfg = effectiveConfig;
    return resolve(
      cfg?.themeId ?? "editorial-dark",
      cfg?.pairingId ?? "modern-sans",
      cfg?.brandColor ?? null,
      cfg?.customPalette,
      direction,
      cfg?.typography ?? null,
    );
  }, [effectiveConfig, direction]);

  useEffect(() => {
    if (!onOrderRoute) {
      // On the landing page (or any non-order route) we MUST NOT apply theme
      // CSS vars. The landing page has its own legacy styling.
      clearTheme();
      return;
    }
    if (resolved) applyTheme(resolved);
    return () => clearTheme();
  }, [resolved, onOrderRoute]);

  // Per-section color overrides layer on top of the theme. Separate effect so a
  // change to only the section colors (not the theme) still re-applies them.
  useEffect(() => {
    if (!onOrderRoute) {
      clearSectionColors();
      return;
    }
    applySectionColors(effectiveConfig?.sectionColors);
    return () => clearSectionColors();
  }, [effectiveConfig?.sectionColors, onOrderRoute]);

  // Live-update the favicon when admin sets it. Browsers don't always pick
  // up changes to the existing <link rel="icon"> href, so we replace the node.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!override || !("faviconURL" in override)) return;
    const url = override.faviconURL;
    if (!url) return;
    const existing = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (existing) existing.remove();
    const link = document.createElement("link");
    link.rel = "icon";
    link.href = url;
    document.head.appendChild(link);
  }, [override]);

  useEffect(() => {
    function onMessage(e: MessageEvent<PreviewMessage>) {
      if (e.data?.type === "foody-theme-preview") {
        const { type, restaurantPreview: rp, ...patch } = e.data;
        setOverride(patch as Partial<WebsiteConfig>);
        setRestaurantPreview(rp ?? null);
      } else if (e.data?.type === "foody-theme-clear") {
        setOverride(null);
        setRestaurantPreview(null);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <ResolvedThemeContext.Provider value={{ resolved, config: effectiveConfig, restaurantPreview }}>
      {children}
    </ResolvedThemeContext.Provider>
  );
}
