"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchRestaurant } from "@/services/api";
import { RestaurantThemeProvider } from "@/lib/restaurant-theme";
import type { WebsiteConfig } from "@/lib/types";

function ThemeFromQuery({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const restaurantId = searchParams.get("restaurantId") || "";
  const [config, setConfig] = useState<WebsiteConfig | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    fetchRestaurant(restaurantId)
      .then((r) => {
        if (!cancelled) setConfig(r.websiteConfig || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  return <RestaurantThemeProvider config={config}>{children}</RestaurantThemeProvider>;
}

export function OrderThemeBridge({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<>{children}</>}>
      <ThemeFromQuery>{children}</ThemeFromQuery>
    </Suspense>
  );
}
