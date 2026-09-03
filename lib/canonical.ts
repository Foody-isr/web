/**
 * Canonical URL rules, kept pure so they can be tested directly.
 *
 * A storefront answers on up to three addresses:
 *
 *   https://mamietlv.co.il/order                  the restaurant's own domain
 *   https://mamie-tlv.app.foody-pos.co.il/order   the Foody subdomain
 *   https://app.foody-pos.co.il/r/mamie-tlv/order the shared path
 *
 * When a restaurant has a domain of its own, that domain is the canonical one
 * and the two Foody copies should say so — otherwise Google reads them as
 * competing duplicates and picks a winner itself, usually the Foody host, and
 * the restaurant's domain earns nothing. When it has no domain, the shared path
 * is its only address and stays its own canonical.
 */

/** A hostname: labels of letters/digits/hyphens, at least one dot, no port. */
const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

/**
 * The restaurant's own domain, or null when it has none or the stored value is
 * not a usable hostname. Anything but a clean hostname is dropped rather than
 * emitted: a malformed canonical is worse than none at all.
 */
export function normalizeCustomDomain(domain?: string | null): string | null {
  const clean = (domain || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return DOMAIN_RE.test(clean) ? clean : null;
}

/**
 * The path as it exists on the restaurant's own domain, where the storefront
 * sits at the root: "/r/mamie-tlv/order" → "/order". Paths already public
 * (served from a custom domain or a Foody subdomain) pass through untouched.
 */
export function storefrontPath(path: string, slug: string | null): string {
  if (!slug) return path;
  const prefix = `/r/${slug}`;
  if (path === prefix) return "/";
  return path.startsWith(`${prefix}/`) ? path.slice(prefix.length) : path;
}

/**
 * Absolute canonical URL for a storefront page.
 *
 * `requestOrigin` is the address actually being served; `customDomain` is the
 * restaurant's own, when it has one. With a custom domain every copy points at
 * it; without one, each address stays its own canonical.
 */
export function buildCanonicalUrl(opts: {
  requestOrigin: string;
  path: string;
  slug: string | null;
  customDomain?: string | null;
}): string {
  const domain = normalizeCustomDomain(opts.customDomain);
  if (!domain) return `${opts.requestOrigin}${opts.path}`;
  return `https://${domain}${storefrontPath(opts.path, opts.slug)}`;
}
