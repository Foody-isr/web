"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { WebsiteConfig } from "@/lib/types";

type RestaurantThemeContextValue = {
  config: WebsiteConfig | null;
};

const RestaurantThemeContext = createContext<RestaurantThemeContextValue>({
  config: null,
});

export function useRestaurantTheme() {
  return useContext(RestaurantThemeContext);
}

/** Compute a darkened hex color (reduce each channel by ~15%). */
function darkenColor(hex: string): string {
  const c = hex.replace("#", "");
  if (c.length !== 6) return hex;
  const r = Math.max(0, Math.round(parseInt(c.slice(0, 2), 16) * 0.82));
  const g = Math.max(0, Math.round(parseInt(c.slice(2, 4), 16) * 0.82));
  const b = Math.max(0, Math.round(parseInt(c.slice(4, 6), 16) * 0.82));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/** Compute a lightened hex color (increase each channel by ~40% toward 255). */
function lightenColor(hex: string): string {
  const c = hex.replace("#", "");
  if (c.length !== 6) return hex;
  const r = Math.min(255, Math.round(parseInt(c.slice(0, 2), 16) + (255 - parseInt(c.slice(0, 2), 16)) * 0.4));
  const g = Math.min(255, Math.round(parseInt(c.slice(2, 4), 16) + (255 - parseInt(c.slice(2, 4), 16)) * 0.4));
  const b = Math.min(255, Math.round(parseInt(c.slice(4, 6), 16) + (255 - parseInt(c.slice(4, 6), 16)) * 0.4));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/** Google Fonts URL for a given font family. */
const FONT_URLS: Record<string, string> = {
  "Nunito Sans": "https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap",
  "Inter": "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap",
  "Poppins": "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap",
  "Rubik": "https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;600;700;800&display=swap",
  "Open Sans": "https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700;800&display=swap",
  "Playfair Display": "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800&display=swap",
};

/** Apply theme settings to the document root. */
function applyTheme(cfg: Partial<WebsiteConfig>) {
  const root = document.documentElement;

  if (cfg.themeMode) {
    root.setAttribute("data-theme", cfg.themeMode);
  }

  if (cfg.primaryColor) {
    root.style.setProperty("--brand", cfg.primaryColor);
    root.style.setProperty("--brand-dark", darkenColor(cfg.primaryColor));
    root.style.setProperty("--brand-light", lightenColor(cfg.primaryColor));
    root.style.setProperty("--price", cfg.primaryColor);
  }

  if (cfg.fontFamily) {
    root.style.setProperty("font-family", `"${cfg.fontFamily}", sans-serif`);
    const fontUrl = FONT_URLS[cfg.fontFamily];
    if (fontUrl && !document.querySelector(`link[href="${fontUrl}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = fontUrl;
      document.head.appendChild(link);
    }
  }
}

/** Remove all custom theme properties from the document root. */
function clearTheme() {
  const root = document.documentElement;
  root.removeAttribute("data-theme");
  root.style.removeProperty("--brand");
  root.style.removeProperty("--brand-dark");
  root.style.removeProperty("--brand-light");
  root.style.removeProperty("--price");
  root.style.removeProperty("font-family");
}

type Props = {
  config: WebsiteConfig | null;
  children: ReactNode;
};

export function RestaurantThemeProvider({ config, children }: Props) {
  const [overrideConfig, setOverrideConfig] = useState<WebsiteConfig | null>(null);

  // Apply theme from config
  useEffect(() => {
    if (!config) return;
    applyTheme(config);
    return () => clearTheme();
  }, [config]);

  // Listen for real-time theme overrides from admin iframe parent
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === "foody-theme-override") {
        applyTheme(e.data.config);
        // Merge override into config so React context consumers get updated values
        setOverrideConfig((prev) => ({ ...(config || {}), ...(prev || {}), ...e.data.config } as WebsiteConfig));
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [config]);

  const mergedConfig = overrideConfig ?? config;

  return (
    <RestaurantThemeContext.Provider value={{ config: mergedConfig }}>
      {children}
    </RestaurantThemeContext.Provider>
  );
}
