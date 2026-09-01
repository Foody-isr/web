"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchRestaurant } from "@/services/api";
import { RestaurantThemeProvider } from "@/lib/restaurant-theme";
import { CurrencyBridge } from "@/components/CurrencyBridge";
import type { WebsiteConfig } from "@/lib/types";

function ThemeFromQuery({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const restaurantId = searchParams.get("restaurantId") || "";
  const [config, setConfig] = useState<WebsiteConfig | null>(null);
  const [currency, setCurrency] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    fetchRestaurant(restaurantId)
      .then((r) => {
        if (cancelled) return;
        setConfig(r.websiteConfig || null);
        setCurrency(r.currency);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  return (
    <RestaurantThemeProvider config={config}>
      <CurrencyBridge currency={currency} />
      {children}
    </RestaurantThemeProvider>
  );
}

export function OrderThemeBridge({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<>{children}</>}>
      <ThemeFromQuery>{children}</ThemeFromQuery>
    </Suspense>
  );
}
