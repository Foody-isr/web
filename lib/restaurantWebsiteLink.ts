/** Resolves a same-restaurant page link while preserving external targets. */
export function resolveRestaurantWebsiteHref(
  link: string | undefined,
  restaurantSlug: string,
): string | null {
  const target = link?.trim();
  if (!target) return null;
  if (
    target.startsWith("http://") ||
    target.startsWith("https://") ||
    target.startsWith("#")
  ) {
    return target;
  }

  const path = target.startsWith("/") ? target : `/${target}`;
  return `/r/${encodeURIComponent(restaurantSlug)}${path}`;
}
