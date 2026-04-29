"use client";

// Compat shim. New code imports from @/lib/themes/useResolvedTheme directly.
// Legacy callers (RestaurantLanding, transitional TopBar/OrderExperience) call useRestaurantTheme().

import {
  ResolvedThemeProvider,
  useResolvedTheme,
} from "./themes/useResolvedTheme";

export const RestaurantThemeProvider = ResolvedThemeProvider;

// Returns the raw WebsiteConfig — same shape legacy callers expect.
export function useRestaurantTheme() {
  const { config } = useResolvedTheme();
  return { config };
}
