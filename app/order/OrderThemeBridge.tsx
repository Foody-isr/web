"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchRestaurant } from "@/services/api";
import { useOrderRoutePage } from "@/hooks/useOrderRoutePage";
import { RestaurantThemeProvider } from "@/lib/restaurant-theme";
import { CurrencyBridge } from "@/components/CurrencyBridge";
import { mergeWebsiteConfigWithPageAppearance } from "@/lib/websiteV3Appearance";
import { CommercePreviewProvider, useCommercePreview } from "@/components/CommercePreviewProvider";
import { mapWebsiteConfig } from "@/lib/websiteConfig";
import type { WebsiteConfig } from "@/lib/types";

function ThemeFromQuery({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const restaurantId = searchParams.get("restaurantId") || "";
  const pageSlug = searchParams.get("pageSlug") || "";
  const { active: previewMode, draft: preview } = useCommercePreview();
  const [siteConfig, setSiteConfig] = useState<WebsiteConfig | null>(null);
  const [currency, setCurrency] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    fetchRestaurant(restaurantId)
      .then((r) => {
        if (cancelled) return;
        setSiteConfig(r.websiteConfig || null);
        setCurrency(r.currency);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  // The order routes below this layout (checkout, confirmation, tracking) all
  // belong to a specific V3 order page, and that page owns its palette: the
  // builder writes `theme_id` + `custom_palette` into `appearance_overrides`,
  // never into the site config. Theming from the site config alone is what made
  // a page-level palette silently do nothing on checkout — the page rendered
  // the site theme in the builder preview and after publishing alike.
  const { data: routePage } = useOrderRoutePage(
    restaurantId,
    pageSlug,
    !previewMode,
  );
  const previewAppearance = preview?.appearanceOverrides;
  const appearance = previewMode
    ? previewAppearance
    : routePage?.appearance_overrides;

  const config = useMemo(
    () =>
      mergeWebsiteConfigWithPageAppearance((mapWebsiteConfig(preview?.siteConfig) ?? siteConfig), appearance, "order"),
    [siteConfig, appearance, preview],
  );

  return (
    <RestaurantThemeProvider config={config}>
      <CurrencyBridge currency={currency} />
      {children}
    </RestaurantThemeProvider>
  );
}

export function OrderThemeBridge({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <CommercePreviewProvider><ThemeFromQuery>{children}</ThemeFromQuery></CommercePreviewProvider>
    </Suspense>
  );
}
