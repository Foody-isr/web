/** Resolves a same-restaurant page link while preserving external targets. */
export function resolveRestaurantWebsiteHref(
  link: string | undefined,
  restaurantSlug: string,
): string | null {
  const target = link?.trim();
  if (!target) return null;
  if (/^(https?:\/\/|mailto:|tel:)/i.test(target) || target.startsWith("#")) {
    return target;
  }

  if (
    /^[a-z][a-z0-9+.-]*:/i.test(target) ||
    target.startsWith("//") ||
    /[\\\u0000-\u001f]/.test(target)
  )
    return null;

  const path = target.startsWith("/") ? target : `/${target}`;
  if (path.startsWith(`/r/${encodeURIComponent(restaurantSlug)}/`) || path === `/r/${encodeURIComponent(restaurantSlug)}`) return path;
  return `/r/${encodeURIComponent(restaurantSlug)}${path}`;
}

/** Resolves the header action against the restaurant's canonical ordering page. */
export function resolveRestaurantNavbarCta(
  link: string | undefined,
  restaurantSlug: string,
  orderUrl: string,
): string {
  const target = link?.trim();
  if (!target || target === "order" || target === "/order") return orderUrl;
  return resolveRestaurantWebsiteHref(target, restaurantSlug) || orderUrl;
}
