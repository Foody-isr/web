import type { MetadataRoute } from "next";

import { isRestaurantHost, requestOrigin } from "@/lib/site-url";

// Reads the request host, so it must be rendered per request rather than baked
// in at build time — one deployment serves every restaurant's robots.txt.
export const dynamic = "force-dynamic";

/**
 * Transactional routes: a cart, a live order, a receipt. They are personal,
 * they change on every visit and none of them means anything to a search
 * engine, so keep crawlers out of them on every host.
 */
const PRIVATE_PATHS = [
  "/order/checkout",
  "/order/confirmation",
  "/order/tracking",
  "/orders",
  "/receipt",
];

export default function robots(): MetadataRoute.Robots {
  const origin = requestOrigin();

  // A restaurant's own domain (or Foody subdomain): the whole site is theirs.
  if (isRestaurantHost()) {
    return {
      rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
      sitemap: `${origin}/sitemap.xml`,
    };
  }

  // The Foody app host. `/r/` stays crawlable on purpose: for every restaurant
  // without a domain of its own it is their only address, and disallowing it
  // would remove them from Google entirely. The root is the marketing site's
  // job, so keep it out of the index.
  return {
    rules: { userAgent: "*", allow: "/r/", disallow: ["/$", ...PRIVATE_PATHS] },
  };
}
