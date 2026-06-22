"use client";

// Compat shim. New code imports from @/lib/themes/useResolvedTheme directly.
// Legacy callers (RestaurantLanding, transitional TopBar/OrderExperience) call useRestaurantTheme().

import {
  ResolvedThemeProvider,
  useResolvedTheme,
} from "./themes/useResolvedTheme";

export const RestaurantThemeProvider = ResolvedThemeProvider;

// Returns the raw WebsiteConfig — same shape legacy callers expect. Also
// surfaces restaurantPreview (live cover/logo edits from the website builder)
// so the hero can layer them over its static restaurant prop.
export function useRestaurantTheme() {
  const { config, restaurantPreview } = useResolvedTheme();
  return { config, restaurantPreview };
}
