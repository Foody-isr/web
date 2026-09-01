// Host classification for middleware routing.
//
// Kept as a pure module (no next/server imports) so the rules can be tested
// directly. The rules are subtle and a mistake here is a production outage:
// a redirect that is meant for Foody's own app root must never fire on a
// restaurant's custom domain.

/** Foody-owned subdomains that are NOT a restaurant storefront. */
export const SKIP_SUBDOMAINS = ['www', 'app', 'dev-app'];

export function isLocalhostHost(host: string): boolean {
  return host.includes('localhost');
}

/** True for Foody's own hosts (any *.foody-pos.co.il) and local dev. */
export function isFoodyHost(host: string): boolean {
  return host.includes('foody-pos.co.il') || isLocalhostHost(host);
}

/**
 * True for `{slug}.app.foody-pos.co.il` (4+ labels) or `{slug}.localhost` in
 * dev — hosts whose traffic is a storefront and gets rewritten to /r/{slug}.
 */
export function isRestaurantSubdomain(host: string): boolean {
  const parts = host.split('.');
  const minParts = isLocalhostHost(host) ? 2 : 4;
  return parts.length >= minParts && !SKIP_SUBDOMAINS.includes(parts[0]);
}

/**
 * Should a request for `/` be sent to the marketing site?
 *
 * Only for Foody's own non-storefront hosts: foody-pos.co.il and its www./
 * app./dev-app. subdomains. Every other host — a restaurant custom domain
 * such as mamietlv.co.il, a storefront subdomain, localhost, a Vercel
 * preview URL — must be left alone.
 */
export function shouldRedirectRootToMarketing(host: string, pathname: string): boolean {
  if (pathname !== '/') return false;
  if (!isFoodyHost(host)) return false;
  if (isLocalhostHost(host)) return false;
  return !isRestaurantSubdomain(host);
}
