"use client";

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { themesById, pairingsById } from "./generated/themes";
import { applyTheme, clearTheme } from "./applyTheme";
import { pickFont } from "./pickFont";
import type { ResolvedTheme, Direction, PreviewMessage } from "./types";
import type { WebsiteConfig } from "@/lib/types";

// The theme system targets the menu/order experience only — landing page
// (RestaurantLanding at /r/<slug>) keeps its own legacy styling per spec
// §1.1. We apply CSS vars only on these routes.
const ORDER_ROUTE_RE =
  /(?:\/r\/[^/]+\/(?:order(?:\/|$|\?)|table(?:\/|$|\?)|t\/))|(?:^\/order\/(?:checkout|tracking)(?:\/|$|\?))/;
function isOrderRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return ORDER_ROUTE_RE.test(pathname);
}

type Ctx = { resolved: ResolvedTheme | null; config: WebsiteConfig | null };
const ResolvedThemeContext = createContext<Ctx>({ resolved: null, config: null });

export const useResolvedTheme = () => useContext(ResolvedThemeContext);

function resolve(
  themeId: string,
  pairingId: string,
  brandOverride: string | null,
  direction: Direction,
): ResolvedTheme | null {
  const theme = themesById[themeId] ?? themesById["editorial-dark"];
  const pairing = pairingsById[pairingId] ?? pairingsById["modern-sans"];
  if (!theme || !pairing) return null;
  return {
    themeId: theme.id,
    pairingId: pairing.id,
    theme,
    pairing,
    brandColorOverride: brandOverride,
    direction,
    fonts: {
      display: pickFont(pairing, "display", direction),
      body: pickFont(pairing, "body", direction),
    },
    layout: theme.layout,
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
      direction,
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
        const { type, ...patch } = e.data;
        setOverride(patch as Partial<WebsiteConfig>);
      } else if (e.data?.type === "foody-theme-clear") {
        setOverride(null);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <ResolvedThemeContext.Provider value={{ resolved, config: effectiveConfig }}>
      {children}
    </ResolvedThemeContext.Provider>
  );
}
