import type { Metadata } from "next";
import { buildRestaurantOgImageUrl } from "./og";
import type { Restaurant } from "./types";
import {
  canonicalRedirectForPage,
  type WebsiteV3Page,
} from "./websiteV3Api";

const DEFAULT_APP_URL = "https://app.foody-pos.co.il";
const DEFAULT_TITLE = "Foody - Order Food Online";
const DEFAULT_DESCRIPTION = "Order your favorite food online with Foody";

export type WebsiteV3Seo = {
  title: string;
  description: string;
  imageUrl: string;
  canonicalUrl: string;
};

/** Resolves every Website V3 SEO consumer value from page data with safe fallbacks. */
export function resolveWebsiteV3Seo({
  restaurant,
  page,
  appUrl,
  routeRestaurantId,
}: {
  restaurant: Restaurant;
  page: WebsiteV3Page;
  appUrl?: string;
  routeRestaurantId: string;
}): WebsiteV3Seo {
  const baseUrl = safeAppUrl(appUrl);
  const restaurantName = text(restaurant.name) || "Foody";
  const fallbackTitle =
    restaurantName === "Foody" && !text(page.title)
      ? DEFAULT_TITLE
      : page.type === "landing"
        ? `${restaurantName} - Order Online`
        : `${text(page.title) || restaurantName} | ${restaurantName}`;
  const title = text(page.seo.title) || fallbackTitle;
  const description =
    text(page.seo.description) ||
    text(restaurant.description) ||
    (restaurantName === "Foody"
      ? DEFAULT_DESCRIPTION
      : `Order from ${restaurantName} online. Fast, easy, and delicious!`);
  const imageUrl =
    safeImageUrl(page.seo.share_image_url, baseUrl) ||
    buildRestaurantOgImageUrl({ ...restaurant, name: restaurantName }, baseUrl);
  const pagePath =
    page.type === "landing"
      ? ""
      : canonicalRedirectForPage(page) ?? `/${encodeURIComponent(page.slug)}`;
  const pathname = `/r/${encodeURIComponent(routeRestaurantId)}${pagePath}`;

  return {
    title,
    description,
    imageUrl,
    canonicalUrl: new URL(pathname, baseUrl).toString(),
  };
}

/** Converts a resolved Website V3 SEO value into canonical Next.js metadata. */
export function websiteV3PageMetadata(seo: WebsiteV3Seo): Metadata {
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: seo.canonicalUrl },
    openGraph: {
      title: seo.title,
      description: seo.description,
      type: "website",
      url: seo.canonicalUrl,
      siteName: "Foody",
      images: [{ url: seo.imageUrl }],
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
      images: [seo.imageUrl],
    },
  };
}

function safeAppUrl(appUrl?: string): string {
  try {
    const parsed = new URL(appUrl || DEFAULT_APP_URL);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : DEFAULT_APP_URL;
  } catch {
    return DEFAULT_APP_URL;
  }
}

function safeImageUrl(value: string | undefined, baseUrl: string): string | null {
  const candidate = text(value);
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate, baseUrl);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function text(value: string | undefined): string {
  return value?.trim() ?? "";
}
