"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchRestaurant } from "@/services/api";
import { useOrderRoutePage } from "@/hooks/useOrderRoutePage";
import { RestaurantThemeProvider } from "@/lib/restaurant-theme";
import { CurrencyBridge } from "@/components/CurrencyBridge";
import { mergeWebsiteConfigWithPageAppearance } from "@/lib/websiteV3Appearance";
import type { PageAppearanceOverrides } from "@/lib/websiteV3Api";
import { mapWebsiteConfig } from "@/lib/websiteConfig";
import type { WebsiteConfig } from "@/lib/types";

function ThemeFromQuery({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const restaurantId = searchParams.get("restaurantId") || "";
  const pageSlug = searchParams.get("pageSlug") || "";
  const previewMode = searchParams.get("preview") === "1";
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
  const preview = useCheckoutPreviewAppearance(previewMode);
  const previewAppearance = preview?.appearance;
  const appearance = previewMode
    ? previewAppearance
    : routePage?.appearance_overrides;

  const config = useMemo(
    () =>
      mergeWebsiteConfigWithPageAppearance(preview?.config ?? siteConfig, appearance, "order"),
    [siteConfig, appearance, preview?.config],
  );

  return (
    <RestaurantThemeProvider config={config}>
      <CurrencyBridge currency={currency} />
      {children}
    </RestaurantThemeProvider>
  );
}

/**
 * The unsaved page appearance pushed by the foodyadmin builder while the
 * checkout is previewed in its iframe. Same `foody-checkout-preview` message
 * the checkout page reads for its draft checkout_config — postMessage fans out
 * to every listener on the window, so both can consume it independently.
 */
function useCheckoutPreviewAppearance(
  previewMode: boolean,
): { appearance: PageAppearanceOverrides | null; config: WebsiteConfig | undefined } | null {
  const [preview, setPreview] = useState<{ appearance: PageAppearanceOverrides | null; config: WebsiteConfig | undefined } | null>(null);

  useEffect(() => {
    if (!previewMode) return;
    function onMessage(e: MessageEvent) {
      const data = e.data;
      if (!data || data.type !== "foody-checkout-preview") return;
      setPreview({
        appearance: data.appearanceOverrides && typeof data.appearanceOverrides === "object"
          ? (data.appearanceOverrides as PageAppearanceOverrides) : null,
        config: mapWebsiteConfig(data.siteConfig),
      });
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [previewMode]);

  return preview;
}

export function OrderThemeBridge({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<>{children}</>}>
      <ThemeFromQuery>{children}</ThemeFromQuery>
    </Suspense>
  );
}
