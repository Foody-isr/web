import type { Locale } from "./i18n";
import { tField } from "./translations";
import type { MenuItem } from "./types";

/** Serving-size label shown under an item's title in guest apps, plus where it
 *  came from. `fromVariants` is true when the label is a range derived from the
 *  item's size-option portions (the modal hides the top label in that case,
 *  since each size row shows its own portion); false for the item-level
 *  portion of an item without sizes. */
export type ItemPortion = {
  label: string;
  fromVariants: boolean;
};

/**
 * Derive the serving-size label shown under an item's title in guest apps.
 *
 * - If the item has a size option set whose options carry portions, returns a
 *   range built from the first and last option (by sort order), e.g.
 *   "250g - 500g", flagged `fromVariants: true`. When both ends are equal (or
 *   there's a single value) the single value is returned. The first option set
 *   with any portion filled wins — in practice the size set.
 * - Otherwise falls back to the item-level portion (e.g. "par personne"),
 *   flagged `fromVariants: false`.
 *
 * `label` is an empty string when nothing is configured.
 */
export function deriveItemPortion(item: MenuItem, locale: Locale): ItemPortion {
  for (const os of item.optionSets ?? []) {
    const portions = [...os.options]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((o) => tField(o, "portion", locale).trim())
      .filter((p) => p.length > 0);
    if (portions.length === 0) continue;
    const first = portions[0];
    const last = portions[portions.length - 1];
    return { label: first === last ? first : `${first} - ${last}`, fromVariants: true };
  }
  return { label: tField(item, "portion", locale).trim(), fromVariants: false };
}
