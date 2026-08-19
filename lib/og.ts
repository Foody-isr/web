import type { Restaurant } from "./types";

const WESERV_BASE = "https://images.weserv.nl/";

/**
 * Builds a weserv.nl URL that transcodes the source image to a 1200×630 JPEG
 * suitable for og:image. weserv normalizes whatever the upload pipeline
 * happened to produce (AVIF/WebP under a .jpg/.png name, mismatched
 * content-types, etc.) into bytes social-preview crawlers can decode, and at
 * a size WhatsApp accepts (~200KB) — unlike satori's PNG output, which is
 * ~1.7MB for the same photo and gets dropped by WhatsApp's preview.
 */
function buildWeservJpegUrl(rawUrl: string, width: number, height: number): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    const stripped = `${parsed.host}${parsed.pathname}${parsed.search}`;
    const u = new URL(WESERV_BASE);
    u.searchParams.set("url", stripped);
    u.searchParams.set("w", String(width));
    u.searchParams.set("h", String(height));
    u.searchParams.set("fit", "cover");
    u.searchParams.set("a", "center");
    u.searchParams.set("output", "jpg");
    u.searchParams.set("q", "80");
    return u.toString();
  } catch {
    return null;
  }
}

export function buildRestaurantOgImageUrl(restaurant: Restaurant, appUrl: string): string {
  if (restaurant.logoUrl) {
    const url = new URL("/api/og", appUrl);
    url.searchParams.set("name", restaurant.name);
    url.searchParams.set("logo", restaurant.logoUrl);
    return url.toString();
  }
  if (restaurant.coverUrl) {
    const weserv = buildWeservJpegUrl(restaurant.coverUrl, 1200, 630);
    if (weserv) return weserv;
  }
  const url = new URL("/api/og", appUrl);
  url.searchParams.set("name", restaurant.name);
  if (restaurant.backgroundColor) {
    url.searchParams.set("bg", restaurant.backgroundColor);
  }
  return url.toString();
}

/**
 * Builds the og:image URL for a single shared item. Points at the /api/og/item
 * edge route, which renders the item photo as the hero (transcoded via weserv)
 * with the item + restaurant name overlaid, and falls back to a text card when
 * the item has no photo.
 */
export function buildItemOgImageUrl(opts: {
  itemName: string;
  itemImageUrl?: string;
  restaurant: Restaurant;
  appUrl: string;
}): string {
  const url = new URL("/api/og/item", opts.appUrl);
  url.searchParams.set("iname", opts.itemName);
  url.searchParams.set("rname", opts.restaurant.name);
  if (opts.itemImageUrl) url.searchParams.set("img", opts.itemImageUrl);
  if (opts.restaurant.backgroundColor) url.searchParams.set("bg", opts.restaurant.backgroundColor);
  return url.toString();
}
