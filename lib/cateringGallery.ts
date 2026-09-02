import type { CateringCatalogItemPublic, CateringCatalogItemImagePublic } from "@/services/api";
import type { Locale } from "@/lib/i18n";
import { tField, type TranslatableEntity } from "@/lib/translations";

export type CateringCarouselImage = {
  key: string;
  url: string;
  alt: string;
  isCover: boolean;
};

function galleryAlt(image: CateringCatalogItemImagePublic, locale: Locale): string {
  const translated = image.translations?.alt_text?.[locale] ?? image.translations?.altText?.[locale];
  if (translated) return translated;
  return tField(image as unknown as TranslatableEntity, "altText", locale, image.altText);
}

/** Builds the detail carousel with the independent cover first and removes any
 * accidentally duplicated URLs without changing the admin-defined order. */
export function cateringCarouselImages(item: CateringCatalogItemPublic, locale: Locale): CateringCarouselImage[] {
  const seen = new Set<string>();
  const images: CateringCarouselImage[] = [];
  const cover = item.imageUrl.trim();
  if (cover) {
    seen.add(cover);
    images.push({ key: "cover", url: cover, alt: item.name, isCover: true });
  }
  for (const image of item.galleryImages ?? []) {
    const url = image.imageUrl.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    images.push({
      key: `gallery-${image.id}`,
      url,
      alt: galleryAlt(image, locale) || item.name,
      isCover: false,
    });
  }
  return images;
}
