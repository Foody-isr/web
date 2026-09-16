import type { CateringCatalogItemPublic } from "@/services/api";
import type { Locale } from "@/lib/i18n";
import { tField, type TranslatableEntity } from "@/lib/translations";

/** Returns the short text shown on a catering catalog card. Legacy/local
 * articles usually have only `description`, while formula editors may provide
 * the dedicated `overview`; both must remain visible to customers. */
export function cateringCatalogItemSummary(item: CateringCatalogItemPublic, locale: Locale): string {
  const entity = item as unknown as TranslatableEntity;
  const overview = tField(entity, "overview", locale, item.overview).trim();
  if (overview) return overview;
  return tField(entity, "description", locale, item.description).trim();
}
