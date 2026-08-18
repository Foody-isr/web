"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchRestaurant } from "@/services/api";
import { useOrderRoutePage } from "@/hooks/useOrderRoutePage";
import { RestaurantThemeProvider } from "@/lib/restaurant-theme";
import { mergeWebsiteConfigWithPageAppearance } from "@/lib/websiteV3Appearance";
import type { PageAppearanceOverrides } from "@/lib/websiteV3Api";
import type { WebsiteConfig } from "@/lib/types";

function ThemeFromQuery({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const restaurantId = searchParams.get("restaurantId") || "";
  const pageSlug = searchParams.get("pageSlug") || "";
  const previewMode = searchParams.get("preview") === "1";
  const [siteConfig, setSiteConfig] = useState<WebsiteConfig | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    fetchRestaurant(restaurantId)
      .then((r) => {
        if (!cancelled) setSiteConfig(r.websiteConfig || null);
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
  const previewAppearance = useCheckoutPreviewAppearance(previewMode);
  const appearance = previewMode
    ? previewAppearance
    : routePage?.appearance_overrides;

  const config = useMemo(
    () =>
      mergeWebsiteConfigWithPageAppearance(siteConfig, appearance, "order"),
    [siteConfig, appearance],
  );

  return <RestaurantThemeProvider config={config}>{children}</RestaurantThemeProvider>;
}

/**
 * The unsaved page appearance pushed by the foodyadmin builder while the
 * checkout is previewed in its iframe. Same `foody-checkout-preview` message
 * the checkout page reads for its draft checkout_config — postMessage fans out
 * to every listener on the window, so both can consume it independently.
 */
function useCheckoutPreviewAppearance(
  previewMode: boolean,
): PageAppearanceOverrides | null {
  const [appearance, setAppearance] = useState<PageAppearanceOverrides | null>(
    null,
  );

  useEffect(() => {
    if (!previewMode) return;
    function onMessage(e: MessageEvent) {
      const data = e.data;
      if (!data || data.type !== "foody-checkout-preview") return;
      setAppearance(
        data.appearanceOverrides && typeof data.appearanceOverrides === "object"
          ? (data.appearanceOverrides as PageAppearanceOverrides)
          : null,
      );
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [previewMode]);

  return appearance;
}

export function OrderThemeBridge({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<>{children}</>}>
      <ThemeFromQuery>{children}</ThemeFromQuery>
    </Suspense>
  );
}
