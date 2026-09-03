import { headers } from "next/headers";

import { buildCanonicalUrl } from "@/lib/canonical";

/**
 * The address a visitor actually used.
 *
 * Every storefront is served from one codebase behind several addresses: the
 * restaurant's own domain (mamietlv.co.il), a Foody subdomain
 * ({slug}.app.foody-pos.co.il) and the shared path (app.foody-pos.co.il/r/{slug}).
 * Middleware rewrites the first two into the third, so by the time a page
 * renders it can no longer see which address the visitor typed.
 *
 * That matters for metadata: a page that declares app.foody-pos.co.il as its
 * canonical URL while being served on mamietlv.co.il tells Google and every
 * social network that the Foody copy is the real one — so the restaurant's own
 * domain earns nothing. Middleware therefore records the public host and path
 * in `x-foody-*` request headers, which these helpers read back.
 */

const FALLBACK_ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL || "https://app.foody-pos.co.il";

/** Hostnames only — anything else is a forged Host header and is ignored. */
const HOST_RE = /^[a-z0-9.-]+(:\d+)?$/;

function publicHost(): string | null {
  const h = headers();
  const raw = (h.get("x-foody-host") || h.get("host") || "").trim().toLowerCase();
  return HOST_RE.test(raw) ? raw : null;
}

/** e.g. "https://mamietlv.co.il" — the origin this request was served on. */
export function requestOrigin(): string {
  const host = publicHost();
  if (!host) return FALLBACK_ORIGIN;
  const isLocal = host.startsWith("localhost") || host.startsWith("127.");
  return `${isLocal ? "http" : "https"}://${host}`;
}

/**
 * The path as the visitor sees it — "/order" on a custom domain, where the
 * rendered route is "/r/mamie-tlv/order". Falls back to the internal path when
 * the request did not pass through a rewrite.
 */
export function publicPath(fallback: string): string {
  return headers().get("x-foody-path") || fallback;
}

/**
 * Absolute canonical URL of the current page. Use it for both
 * `alternates.canonical` and `openGraph.url`, which must agree.
 *
 * Pass the restaurant's own domain (`restaurant.customDomain`) and every copy
 * of the storefront — the Foody subdomain and the shared /r/{slug} path —
 * points at it, so Google consolidates the three addresses onto the domain the
 * restaurant pays for. Omit it, or pass an empty value for a restaurant that
 * has no domain of its own, and each address stays its own canonical.
 */
export function canonicalUrl(fallbackPath: string, customDomain?: string | null): string {
  return buildCanonicalUrl({
    requestOrigin: requestOrigin(),
    path: publicPath(fallbackPath),
    slug: requestSlug(),
    customDomain,
  });
}

/** Restaurant slug for this host, recorded by middleware. */
export function requestSlug(): string | null {
  return headers().get("x-foody-slug");
}

/** True when this host serves a single restaurant, not the Foody app itself. */
export function isRestaurantHost(): boolean {
  return requestSlug() !== null;
}
