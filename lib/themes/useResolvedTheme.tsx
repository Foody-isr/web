"use client";

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { themesById, pairingsById } from "./generated/themes";
import { applyTheme, clearTheme } from "./applyTheme";
import { pickFont } from "./pickFont";
import type { ResolvedTheme, Direction, PreviewMessage } from "./types";
import type { WebsiteConfig } from "@/lib/types";

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
  const [override, setOverride] = useState<Partial<{
    themeId: string; pairingId: string; brandColor: string | null;
  }>>({});

  const resolved = useMemo(() => {
    return resolve(
      override.themeId ?? config?.themeId ?? "editorial-dark",
      override.pairingId ?? config?.pairingId ?? "modern-sans",
      override.brandColor ?? config?.brandColor ?? null,
      direction,
    );
  }, [config, override, direction]);

  useEffect(() => {
    if (resolved) applyTheme(resolved);
    return () => clearTheme();
  }, [resolved]);

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
