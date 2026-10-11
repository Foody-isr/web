"use client";

import { useEffect, useState } from "react";
import type { Restaurant } from "@/lib/types";
import type { WebsiteV3Page } from "@/lib/websiteV3Api";
import { resolveWebsiteV3Seo } from "@/lib/websiteV3Metadata";

/** Mirrors draft SEO state into the preview iframe document head. */
export function WebsitePagePreviewSeo({
  restaurant,
  page,
}: {
  restaurant: Restaurant;
  page: WebsiteV3Page;
}) {
  const [origin, setOrigin] = useState<string>();
  useEffect(() => setOrigin(window.location.origin), []);
  const seo = resolveWebsiteV3Seo({
    restaurant,
    page,
    appUrl: origin,
    routeRestaurantId: restaurant.slug || String(restaurant.id),
  });

  // React hoists these nodes into the head. Imperatively removing preview
  // metadata can detach a node adopted by streamed Next.js metadata, making
  // the next page/style update fail during React's deletion effects.
  return (
    <>
      <title>{seo.title}</title>
      <meta name="description" content={seo.description} />
      <meta property="og:image" content={seo.imageUrl} />
    </>
  );
}
