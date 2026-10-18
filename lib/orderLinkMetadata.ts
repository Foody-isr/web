import type { Metadata } from "next";
import { buildRestaurantLogoOgImageUrl } from "./og";
import type { Restaurant } from "./types";

type OrderLinkKind = "receipt" | "confirmation";
type RestaurantIdentity = Pick<
  Restaurant,
  "name" | "logoUrl" | "websiteConfig" | "backgroundColor"
>;

/** Builds private order-link previews using only the restaurant's public identity. */
export function buildOrderLinkMetadata(
  kind: OrderLinkKind,
  restaurant: RestaurantIdentity | null,
  appUrl: string,
): Metadata {
  const label = kind === "receipt" ? "Receipt" : "Order confirmation";
  const name = restaurant?.name.trim();
  const title = name ? `${label} | ${name}` : label;
  const description = name
    ? `View your ${kind === "receipt" ? "receipt" : "order confirmation"} from ${name}.`
    : `View your ${kind === "receipt" ? "receipt" : "order confirmation"}.`;
  const imageUrl =
    name && restaurant
      ? buildRestaurantLogoOgImageUrl({ ...restaurant, name }, appUrl)
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
