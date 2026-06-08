import type { Locale } from "./i18n";
import { tField } from "./translations";
import type { MenuItem } from "./types";

/**
 * Derive the serving-size label shown under an item's title in guest apps.
 *
 * - If the item has a size option set whose options carry portions, returns a
 *   range built from the first and last option (by sort order), e.g.
 *   "250g - 500g". When both ends are equal (or there's a single value) the
 *   single value is returned. The first option set with any portion filled
 *   wins — in practice the size set.
 * - Otherwise falls back to the item-level portion (e.g. "par personne").
 *
 * Returns an empty string when nothing is configured.
 */
export function deriveItemPortionLabel(item: MenuItem, locale: Locale): string {
  for (const os of item.optionSets ?? []) {
    const portions = [...os.options]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((o) => tField(o, "portion", locale).trim())
      .filter((p) => p.length > 0);
    if (portions.length === 0) continue;
    const first = portions[0];
    const last = portions[portions.length - 1];
    return first === last ? first : `${first} - ${last}`;
  }
  return tField(item, "portion", locale).trim();
}
