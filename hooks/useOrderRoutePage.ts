"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchDefaultWebsitePage,
  fetchWebsitePage,
  type WebsiteV3Page,
} from "@/lib/websiteV3Api";

/**
 * The V3 page whose appearance an `/order/*` route must render with.
 *
 * `?pageSlug` names the exact order page the guest came from (OrderExperience
 * always sets it); without it we fall back to the restaurant's default order
 * page, which is what deep links and QR entries land on.
 *
 * Both the layout's theme bridge and the checkout page need this page — the
 * bridge to resolve the palette, the page to resolve its checkout text roles —
 * so they share this hook and its query key and the router issues one request.
 *
 * Pass `enabled: false` in builder preview mode: there the unsaved draft
 * arrives over the `foody-checkout-preview` postMessage channel instead, and
 * the published page would overwrite it.
 */
export function useOrderRoutePage(
  restaurantId: string,
  pageSlug: string,
  enabled = true,
) {
  return useQuery<WebsiteV3Page | null>({
    queryKey: ["checkout-page-appearance", restaurantId, pageSlug],
    queryFn: async () => {
      const exactPage = pageSlug
        ? await fetchWebsitePage(restaurantId, pageSlug)
        : null;
      return exactPage ?? fetchDefaultWebsitePage(restaurantId, "order");
    },
    enabled: Boolean(restaurantId && enabled),
  });
}
