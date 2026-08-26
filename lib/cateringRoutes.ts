export type CateringPathSelection = {
  serviceSlug?: string;
  itemSlug?: string;
};

/** Canonical public catering hub path for one restaurant. */
export function cateringBasePath(restaurantSlug: string): string {
  return `/r/${encodeURIComponent(restaurantSlug)}/catering`;
}

/** Canonical public path for one catering service. */
export function cateringServicePath(restaurantSlug: string, serviceSlug: string): string {
  return `${cateringBasePath(restaurantSlug)}/${encodeURIComponent(serviceSlug)}`;
}

/** Canonical public path for one formula inside its catering service. */
export function cateringItemPath(
  restaurantSlug: string,
  serviceSlug: string,
  itemSlug: string,
): string {
  return `${cateringServicePath(restaurantSlug, serviceSlug)}/${encodeURIComponent(itemSlug)}`;
}

/** Parses only catalog routes. Quote routes and unrelated paths return null. */
export function parseCateringPath(
  pathname: string,
  restaurantSlug: string,
): CateringPathSelection | null {
  const base = cateringBasePath(restaurantSlug);
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (normalized === base) return {};
  if (!normalized.startsWith(`${base}/`)) return null;

  const rawSegments = normalized.slice(base.length + 1).split("/");
  if (rawSegments.length < 1 || rawSegments.length > 2 || rawSegments[0] === "quote") return null;
  try {
    const serviceSlug = decodeURIComponent(rawSegments[0]);
    const itemSlug = rawSegments[1] ? decodeURIComponent(rawSegments[1]) : undefined;
    if (!serviceSlug) return null;
    return itemSlug ? { serviceSlug, itemSlug } : { serviceSlug };
  } catch {
    return null;
  }
}
