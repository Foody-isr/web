"use client";

import { createContext, useContext, useEffect, ReactNode } from "react";
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

type Props = {
  config: WebsiteConfig | null;
  children: ReactNode;
};

export function RestaurantThemeProvider({ config, children }: Props) {
  useEffect(() => {
    if (!config) return;

    const root = document.documentElement;

    // Apply theme mode (light/dark)
    const themeMode = config.themeMode || "light";
    root.setAttribute("data-theme", themeMode);

    // Apply brand colors as CSS custom properties
    if (config.primaryColor) {
      root.style.setProperty("--brand", config.primaryColor);
      root.style.setProperty("--brand-dark", darkenColor(config.primaryColor));
      root.style.setProperty("--brand-light", lightenColor(config.primaryColor));
      root.style.setProperty("--price", config.primaryColor);
    }

    // Apply font family
    if (config.fontFamily && config.fontFamily !== "Nunito Sans") {
      root.style.setProperty("font-family", `"${config.fontFamily}", sans-serif`);

      // Load font from Google Fonts if not already loaded
      const fontUrl = FONT_URLS[config.fontFamily];
      if (fontUrl && !document.querySelector(`link[href="${fontUrl}"]`)) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = fontUrl;
        document.head.appendChild(link);
      }
    }

    return () => {
      // Cleanup: restore defaults
      root.removeAttribute("data-theme");
      root.style.removeProperty("--brand");
      root.style.removeProperty("--brand-dark");
      root.style.removeProperty("--brand-light");
      root.style.removeProperty("--price");
      root.style.removeProperty("font-family");
    };
  }, [config]);

  return (
    <RestaurantThemeContext.Provider value={{ config }}>
      {children}
    </RestaurantThemeContext.Provider>
  );
}
