"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { CartOverlay } from "./CartOverlay";
import { RestaurantThemeProvider } from "@/lib/restaurant-theme";
import { mergeWebsiteConfigWithPageAppearance } from "@/lib/websiteV3Appearance";
import type { Restaurant } from "@/lib/types";
import type { WebsiteV3Page } from "@/lib/websiteV3Api";
import { CartNavigationContext, type OpenCartOverlay } from "@/hooks/useCartOverlayNavigation";

/** Keep cart opening and browser history local; standalone URLs still render on the server. */
export function CartOverlayController({ children, restaurant, pages, preferredPageSlug, scope }: {
  children: ReactNode;
  restaurant: Restaurant;
  pages: WebsiteV3Page[];
  preferredPageSlug?: string;
  scope: string;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const restaurantId = String(restaurant.id);
  const owner = `${restaurantId}:${scope}`;
  const pageSlug = params.get("pageSlug") || preferredPageSlug || "";
  const sourcePage = pages.find(page => page.slug === pageSlug)
    ?? pages.find(page => page.type === "order" && page.is_default)
    ?? pages.find(page => page.type === "order");
  const config = useMemo(() => mergeWebsiteConfigWithPageAppearance(
    restaurant.websiteConfig, sourcePage?.appearance_overrides, "order",
  ), [restaurant.websiteConfig, sourcePage]);
  const open = pathname === "/order/cart" && typeof window !== "undefined"
    && window.history.state?.foodyCartOverlay === owner;

  const openCart = useCallback<OpenCartOverlay>((href, options) => {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin || url.pathname !== "/order/cart"
      || url.searchParams.get("restaurantId") !== restaurantId) return false;
    const requestedSlug = url.searchParams.get("pageSlug") || preferredPageSlug || "";
    const page = requestedSlug ? pages.find(page => page.slug === requestedSlug)
      : pages.find(page => page.type === "order" && page.is_default)
        ?? pages.find(page => page.type === "order");
    // An unknown page must resolve through the standalone server route instead.
    if (requestedSlug && !page) return false;
    const selectedSlug = requestedSlug || page?.slug || "";
    if (selectedSlug) url.searchParams.set("pageSlug", selectedSlug);
    queryClient.setQueryData(["order-theme-restaurant", restaurantId], restaurant);
    queryClient.setQueryData(["checkout-page-appearance", restaurantId, selectedSlug], page ?? null);
    const target = url.pathname + url.search + url.hash;
    // Next's native-history integration copies its router state and updates
    // usePathname/useSearchParams without fetching a server-component payload.
    // Do not copy __NA ourselves: Next treats that as an internal router call.
    const state = { foodyCartOverlay: owner };
    if (options?.replace && window.history.state?.foodyCartOverlay === owner) {
      window.history.replaceState(state, "", target);
    } else if (!open) {
      window.history.pushState(state, "", target);
    }
    return true;
  }, [restaurantId, preferredPageSlug, pages, queryClient, restaurant, owner, open]);

  return (
    <CartNavigationContext.Provider value={openCart}>
      {children}
      {open && <RestaurantThemeProvider config={config} pageMode="commerce">
        <CartOverlay initialRestaurant={restaurant} />
      </RestaurantThemeProvider>}
    </CartNavigationContext.Provider>
  );
}
