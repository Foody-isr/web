"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { Restaurant } from "@/lib/types";
import { fetchLoyaltyProgram } from "@/services/api";

/** Reads the visible path after confirming that this is a live storefront. */
export function useLiveRestaurantPath(): string | null {
  const pathname = usePathname();
  const [path, setPath] = useState<string | null>(null);

  useEffect(() => {
    const live = window.self === window.top &&
      !new URLSearchParams(window.location.search).has("preview");
    setPath(live ? window.location.pathname : null);
  }, [pathname]);

  return path;
}

/** Reads the public program independently of the visitor's account. */
export function usePublicLoyaltyProgram(restaurantId: number, enabled: boolean) {
  return useQuery({
    queryKey: ["loyalty-program", restaurantId],
    queryFn: ({ signal }) => fetchLoyaltyProgram(restaurantId, signal),
    enabled: enabled && Number.isSafeInteger(restaurantId) && restaurantId > 0,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
}

/** Resolves the loyalty page on shared Foody URLs and restaurant domains. */
export function restaurantLoyaltyHref(restaurant: Pick<Restaurant, "id" | "slug">, path: string): string {
  const root = path.startsWith("/r/")
    ? `/r/${encodeURIComponent(restaurant.slug || String(restaurant.id))}`
    : "";
  return `${root}/account/loyalty`;
}

/** Exposes a website link when the restaurant has a published, active program. */
export function usePublishedLoyaltyHref(restaurant: Restaurant, hasNavigation: boolean): string | undefined {
  const path = useLiveRestaurantPath();
  const program = usePublicLoyaltyProgram(restaurant.id, hasNavigation && path !== null);
  if (hasNavigation && path !== null && program.isSuccess) {
    return restaurantLoyaltyHref(restaurant, path);
  }
}
