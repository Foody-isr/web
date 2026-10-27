import type { MenuItem } from "@/lib/types";

/** Returns the cover and ordered detail photos once each, including legacy items. */
export function productPhotos(
  item: Pick<MenuItem, "imageUrl" | "imageUrls">,
): string[] {
  return Array.from(
    new Set(
      [item.imageUrl, ...(item.imageUrls ?? [])].filter(
        (url): url is string => typeof url === "string" && !!url.trim(),
      ),
    ),
  );
}
