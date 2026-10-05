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
  return `/r/${encodeURIComponent(restaurantSlug)}${path}`;
}
