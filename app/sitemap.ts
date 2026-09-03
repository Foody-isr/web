import type { MetadataRoute } from "next";

import { fetchRestaurant } from "@/services/api";
import { requestOrigin, requestSlug } from "@/lib/site-url";

// One deployment serves every restaurant, so the sitemap is built per request
// from the host rather than baked in at build time.
export const dynamic = "force-dynamic";

/**
 * Sitemap for the restaurant this host serves.
 *
 * URLs are written on the address the visitor uses — mamietlv.co.il/order, not
 * app.foody-pos.co.il/r/mamie-tlv/order — because a sitemap listing a different
 * host than the one serving it is ignored by search engines.
 *
 * The Foody app host gets an empty sitemap: its root is the marketing site's
 * job, and each restaurant is announced by its own.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slug = requestSlug();
  if (!slug) return [];

  // Middleware only records a slug for a host that serves one restaurant — a
  // custom domain or a Foody subdomain — and on both the storefront sits at the
  // root. The shared app host has no slug and returns above.
  const base = requestOrigin();
  const now = new Date();

  const entry = (path: string, priority: number): MetadataRoute.Sitemap[number] => ({
    url: `${base}${path || "/"}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority,
  });

  try {
    const restaurant = await fetchRestaurant(slug);
    const config = restaurant.websiteConfig;

    const entries = [entry("", 1), entry("/order", 0.9)];

    if (config?.storiesEnabled === true) {
      entries.push(entry("/stories", 0.5));
    }
    for (const page of config?.pages || []) {
      if (page.slug) entries.push(entry(`/${page.slug}`, 0.6));
    }
    return entries;
  } catch {
    // The API is unreachable; still announce the two pages every storefront has
    // rather than serving an empty sitemap that unlists the whole site.
    return [entry("", 1), entry("/order", 0.9)];
  }
}
