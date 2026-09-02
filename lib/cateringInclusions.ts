import type {
  CateringCatalogItemPublic,
  CateringIncludedItemPublic,
  CateringIncludedSectionPublic,
} from "@/services/api";
import type { Locale } from "@/lib/i18n";
import { tField, type TranslatableEntity } from "@/lib/translations";

export type InclusionGroupView = {
  id: string;
  title: string;
  description: string;
  items: string[];
};

function includedItemField(item: CateringIncludedItemPublic, locale: Locale): string {
  return tField(item as unknown as TranslatableEntity, "name", locale, item.name);
}

function includedSectionField(section: CateringIncludedSectionPublic, field: "name" | "description", locale: Locale): string {
  return tField(section as unknown as TranslatableEntity, field, locale, section[field]);
}

/** Builds the customer-facing hierarchy while de-duplicating the flattened
 * compatibility list returned for older clients. */
export function structuredInclusionGroups(item: CateringCatalogItemPublic, locale: Locale): InclusionGroupView[] {
  const sectionedIds = new Set<number>();
  const groups = (item.includedSections ?? []).map((section) => {
    for (const included of section.items) sectionedIds.add(included.id);
    return {
      id: `section-${section.id}`,
      title: includedSectionField(section, "name", locale),
      description: includedSectionField(section, "description", locale),
      items: section.items.map((included) => includedItemField(included, locale)).filter(Boolean),
    };
  });
  const looseItems = item.includedItems
    .filter((included) => !included.sectionId && !sectionedIds.has(included.id))
    .map((included) => includedItemField(included, locale))
    .filter(Boolean);
  if (looseItems.length > 0) groups.push({ id: "unsectioned", title: "", description: "", items: looseItems });
  return groups.filter((group) => group.items.length > 0);
}
