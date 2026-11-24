import type { Metadata } from "next";
import { cache } from "react";
import { fetchOrder } from "@/services/api";
import { buildRestaurantOgImageUrl, type RestaurantShareIdentity } from "./og";
import { requestOrigin } from "./site-url";
import { getPublishedWebsiteRestaurant } from "./websiteV3PageContext";

const orderLinkText = {
  receipt: { label: "Receipt", action: "View your receipt" },
  confirmation: { label: "Order confirmation", action: "View your order confirmation" },
  tracking: { label: "Order tracking", action: "Track your order" },
};

type OrderLinkKind = keyof typeof orderLinkText;

export type GuestOrderPageProps = {
  params: Promise<{ orderId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/** Shares the validated order lookup with the page renderer within a request. */
export const getSharedOrder = cache(fetchOrder);

/** Resolves the restaurant for an existing confirmation or tracking link. */
export async function resolveGuestOrderPageMetadata(
  kind: "confirmation" | "tracking",
  { params, searchParams }: GuestOrderPageProps,
): Promise<Metadata> {
  const [{ orderId }, search, appUrl] = await Promise.all([
    params,
    searchParams,
    requestOrigin(),
  ]);
  const restaurantId = typeof search?.restaurantId === "string" ? search.restaurantId : "";
  const token = typeof search?.t === "string" ? search.t : undefined;
  if (!restaurantId) return buildOrderLinkMetadata(kind, null, appUrl);

  try {
    const [, restaurant] = await Promise.all([
      getSharedOrder(orderId, restaurantId, token),
      getPublishedWebsiteRestaurant(restaurantId),
    ]);
    return buildOrderLinkMetadata(kind, restaurant, appUrl);
  } catch {
    return buildOrderLinkMetadata(kind, null, appUrl);
  }
}

/** Builds order-link previews from the restaurant's published branding. */
export function buildOrderLinkMetadata(
  kind: OrderLinkKind,
  restaurant: RestaurantShareIdentity | null,
  appUrl: string,
): Metadata {
  const { label, action } = orderLinkText[kind];
  const name = restaurant?.name.trim();
  const title = name ? `${label} | ${name}` : label;
  const description = `${action}${name ? ` from ${name}` : ""}.`;
  const imageUrl =
    name && restaurant
      ? buildRestaurantOgImageUrl({ ...restaurant, name }, appUrl)
      : null;

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "website",
      siteName: name || label,
      images: imageUrl
        ? [{ url: imageUrl, width: 1200, height: 630, alt: name }]
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: imageUrl ? [imageUrl] : [],
    },
  };
}
