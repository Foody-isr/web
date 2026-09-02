"use client";

import { useEffect } from "react";
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
  useEffect(() => {
    const seo = resolveWebsiteV3Seo({
      restaurant,
      page,
      appUrl: window.location.origin,
      routeRestaurantId: restaurant.slug || String(restaurant.id),
    });
    const previousTitle = document.title;
    const restoreDescription = setMeta("name", "description", seo.description);
    const restoreImage = setMeta("property", "og:image", seo.imageUrl);
    document.title = seo.title;

    return () => {
      document.title = previousTitle;
      restoreDescription();
      restoreImage();
    };
  }, [page, restaurant]);

  return null;
}

function setMeta(
  attribute: "name" | "property",
  value: string,
  content: string,
): () => void {
  const selector = `meta[${attribute}="${value}"]`;
  const existing = document.head.querySelector<HTMLMetaElement>(selector);
  const meta = existing ?? document.createElement("meta");
  const previousContent = existing ? existing.getAttribute("content") : null;
  if (!existing) {
    meta.setAttribute(attribute, value);
    document.head.append(meta);
  }
  meta.setAttribute("content", content);

  return () => {
    if (!existing) {
      meta.remove();
    } else if (previousContent === null) {
      meta.removeAttribute("content");
    } else {
      meta.setAttribute("content", previousContent);
    }
  };
}
