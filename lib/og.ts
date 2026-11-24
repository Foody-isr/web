import type { Restaurant } from "./types";
import { resolveSiteColorStyle, siteHex } from "./siteColors";

const WESERV_BASE = "https://images.weserv.nl/";

export type RestaurantShareIdentity = Pick<
  Restaurant,
  "name" | "logoUrl" | "coverUrl" | "backgroundColor" | "websiteConfig"
>;

function parseShareImageUrl(value: string | undefined, appUrl: string): URL | null {
  const source = value?.trim();
  if (!source) return null;
  try {
    const url = new URL(source, source.startsWith("/") ? appUrl : undefined);
    return (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username && !url.password
      ? url
      : null;
  } catch {
    return null;
  }
}

/**
 * Builds a weserv.nl URL that transcodes the source image to a 1200×630 JPEG
 * suitable for og:image. weserv normalizes whatever the upload pipeline
 * happened to produce (AVIF/WebP under a .jpg/.png name, mismatched
 * content-types, etc.) into bytes social-preview crawlers can decode, and at
 * a size WhatsApp accepts (~200KB) — unlike satori's PNG output, which is
 * ~1.7MB for the same photo and gets dropped by WhatsApp's preview.
 */
function buildWeservJpegUrl(source: URL): string {
  const url = new URL(WESERV_BASE);
  url.searchParams.set("url", `${source.host}${source.pathname}${source.search}`);
  url.searchParams.set("w", "1200");
  url.searchParams.set("h", "630");
  url.searchParams.set("fit", "cover");
  url.searchParams.set("a", "center");
  url.searchParams.set("output", "jpg");
  url.searchParams.set("q", "80");
  return url.toString();
}

/**
 * Resolves the logo card background from the published share setting.
 * The brand option uses the site brand colour or the default site's background.
 */
function resolveShareBg(restaurant: Pick<Restaurant, "websiteConfig" | "backgroundColor">): string {
  const config = restaurant.websiteConfig;
  if (config?.shareImageBg === "black") return "#000000";
  if (config?.shareImageBg === "brand") {
    const palette = config.customPalette;
    const colors = [
      config.brandColor,
      resolveSiteColorStyle(palette)?.background,
      config.themeId === "custom" ? palette?.bg : undefined,
      restaurant.backgroundColor,
    ];
    const brand = colors.map((color) => siteHex(color, "")).find(Boolean);
    if (brand) return brand;
  }
  return "#FFFFFF";
}

/** Builds a restaurant logo card, falling back to its name when no logo is set. */
function buildRestaurantLogoOgImageUrl(
  restaurant: RestaurantShareIdentity,
  appUrl: string,
): string {
  const url = new URL("/api/og", appUrl);
  url.searchParams.set("name", restaurant.name);
  if (restaurant.logoUrl) {
    url.searchParams.set("logo", restaurant.logoUrl);
    url.searchParams.set("bg", resolveShareBg(restaurant));
    // Refresh cards generated before transparent logos were supported.
    url.searchParams.set("v", "2");
  } else if (restaurant.backgroundColor) {
    url.searchParams.set("bg", restaurant.backgroundColor);
  }
  return url.toString();
}

/** Renders the configured share image in the same mode for every restaurant link. */
export function buildConfiguredRestaurantOgImageUrl(
  restaurant: RestaurantShareIdentity,
  appUrl: string,
): string | null {
  const config = restaurant.websiteConfig;
  const source = parseShareImageUrl(config?.shareImageUrl, appUrl);
  if (!source) return null;
  if (config?.shareImageMode === "cover") return buildWeservJpegUrl(source);
  return buildRestaurantLogoOgImageUrl({ ...restaurant, logoUrl: source.href }, appUrl);
}

/** Uses the configured share image, a page image, or the restaurant's public identity. */
export function buildRestaurantOgImageUrl(
  restaurant: RestaurantShareIdentity,
  appUrl: string,
  pageImageUrl?: string | null,
): string {
  const sharedImage = buildConfiguredRestaurantOgImageUrl(restaurant, appUrl) || pageImageUrl;
  if (sharedImage) return sharedImage;
  const cover = parseShareImageUrl(restaurant.coverUrl, appUrl);
  if (!restaurant.logoUrl && cover) return buildWeservJpegUrl(cover);
  return buildRestaurantLogoOgImageUrl(restaurant, appUrl);
}

/**
 * Uses the restaurant's configured share image or a card with the item photo and name.
 */
export function buildItemOgImageUrl(opts: {
  itemName: string;
  itemImageUrl?: string;
  restaurant: Restaurant;
  appUrl: string;
}): string {
  const sharedImage = buildConfiguredRestaurantOgImageUrl(opts.restaurant, opts.appUrl);
  if (sharedImage) return sharedImage;
  const url = new URL("/api/og/item", opts.appUrl);
  url.searchParams.set("iname", opts.itemName);
  url.searchParams.set("rname", opts.restaurant.name);
  if (opts.itemImageUrl) url.searchParams.set("img", opts.itemImageUrl);
  if (opts.restaurant.backgroundColor) url.searchParams.set("bg", opts.restaurant.backgroundColor);
  return url.toString();
}
