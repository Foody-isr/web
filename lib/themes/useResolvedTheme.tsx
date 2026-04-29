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
const ORDER_ROUTE_RE = /\/r\/[^/]+\/(order(\/|$|\?)|table(\/|$|\?)|t\/)/;
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

  const [override, setOverride] = useState<Partial<{
    themeId: string; pairingId: string; brandColor: string | null;
  }>>({});

  // brandColor in override is special: undefined means "no override", null
  // means "explicit clear" (override the saved config back to no override).
  const resolved = useMemo(() => {
    const brand =
      "brandColor" in override
        ? override.brandColor ?? null
        : config?.brandColor ?? null;
    return resolve(
      override.themeId ?? config?.themeId ?? "editorial-dark",
      override.pairingId ?? config?.pairingId ?? "modern-sans",
      brand,
      direction,
    );
  }, [config, override, direction]);

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

  useEffect(() => {
    function onMessage(e: MessageEvent<PreviewMessage>) {
      if (e.data?.type === "foody-theme-preview") {
        setOverride({
          themeId: e.data.themeId,
          pairingId: e.data.pairingId,
          brandColor: e.data.brandColor,
        });
      } else if (e.data?.type === "foody-theme-clear") {
        setOverride({});
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <ResolvedThemeContext.Provider value={{ resolved, config }}>
      {children}
    </ResolvedThemeContext.Provider>
  );
}
