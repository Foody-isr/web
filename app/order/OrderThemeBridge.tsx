"use client";

import { Suspense, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { fetchRestaurant } from "@/services/api";
import { useOrderRoutePage } from "@/hooks/useOrderRoutePage";
import { RestaurantThemeProvider } from "@/lib/restaurant-theme";
import { CurrencyBridge } from "@/components/CurrencyBridge";
import { mergeWebsiteConfigWithPageAppearance } from "@/lib/websiteV3Appearance";
import { CommercePreviewProvider, useCommercePreview } from "@/components/CommercePreviewProvider";
import { mapWebsiteConfig } from "@/lib/websiteConfig";
import type { OrderThemeSeed } from "@/lib/orderTheme";
import { CartOverlayController } from "@/components/CartOverlayController";

function ThemeFromQuery({ children, initialTheme, enableCartOverlay }: { children: React.ReactNode; initialTheme?: OrderThemeSeed; enableCartOverlay: boolean }) {
  const searchParams = useSearchParams();
  const restaurantId = searchParams.get("restaurantId") || "";
  const pageSlug = searchParams.get("pageSlug") || "";
  const { active: previewMode, draft: preview } = useCommercePreview();
  const seed = initialTheme?.restaurantId === restaurantId ? initialTheme : undefined;
  const restaurantQuery = useQuery({
    queryKey: ["order-theme-restaurant", restaurantId],
    queryFn: () => fetchRestaurant(restaurantId),
    enabled: Boolean(restaurantId && !previewMode),
    initialData: seed?.restaurant,
  });
  const siteConfig = restaurantQuery.data?.websiteConfig ?? null;

  // The order routes below this layout (checkout, confirmation, tracking) all
  // belong to a specific V3 order page, and that page owns its palette: the
  // builder writes `theme_id` + `custom_palette` into `appearance_overrides`,
  // never into the site config. Theming from the site config alone is what made
  // a page-level palette silently do nothing on checkout — the page rendered
  // the site theme in the builder preview and after publishing alike.
  const pageQuery = useOrderRoutePage(
    restaurantId,
    pageSlug,
    !previewMode,
    seed?.pageSlug === pageSlug ? seed.page : undefined,
  );
  const previewAppearance = preview?.appearanceOverrides;
  const appearance = previewMode
    ? previewAppearance
    : pageQuery.data?.appearance_overrides;
  const ready = previewMode ? !!preview : !restaurantId || (restaurantQuery.isSuccess && pageQuery.isSuccess);

  const config = useMemo(
    () =>
      mergeWebsiteConfigWithPageAppearance((mapWebsiteConfig(preview?.siteConfig) ?? siteConfig), appearance, "order"),
    [siteConfig, appearance, preview],
  );

  return (
    <RestaurantThemeProvider config={config} ready={ready}>
      <CurrencyBridge currency={restaurantQuery.data?.currency} />
      {enableCartOverlay && !previewMode && restaurantQuery.data ?
        <CartOverlayController restaurant={restaurantQuery.data} pages={pageQuery.data ? [pageQuery.data] : []}
          preferredPageSlug={pageQuery.data?.slug} scope="checkout">
          {children}
        </CartOverlayController> : children}
    </RestaurantThemeProvider>
  );
}

/** Keep the server-seeded order appearance and live preview in one theme context. */
export function OrderThemeBridge({ children, initialTheme, enableCartOverlay = false }: { children: React.ReactNode; initialTheme?: OrderThemeSeed; enableCartOverlay?: boolean }) {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <CommercePreviewProvider><ThemeFromQuery initialTheme={initialTheme} enableCartOverlay={enableCartOverlay}>{children}</ThemeFromQuery></CommercePreviewProvider>
    </Suspense>
  );
}
