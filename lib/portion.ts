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

/**
 * Serving-size label to show under the title in the item modal, following the
 * customer's current size selection.
 *
 * Unlike {@link deriveItemPortion} (which yields a static range for the item
 * cards, where there is no selection), this tracks the chosen size so the line
 * can never contradict it. The modal lets the customer pick a size via the
 * item's primary option set — the first set that has options, which is also the
 * one that drives the displayed price. When that set offers a real choice (2+
 * options) we surface the SELECTED option's size: its `portion` field when
 * filled, otherwise its name (this restaurant encodes sizes in the option name,
 * e.g. "250g"/"500g", leaving the portion field empty — which is why the range
 * above never appears for it).
 *
 * Falls back to the static item-level portion (e.g. "par personne") for items
 * without a multi-option size set. Returns an empty string when nothing is
 * configured.
 *
 * @param selectedOptionIds optionSetId -> chosen option id (modal state). When a
 *        set has no entry, its first option is used — the modal's default
 *        selection.
 */
export function modalPortionLabel(
  item: MenuItem,
  locale: Locale,
  selectedOptionIds: Record<number, number> = {},
): string {
  const sizeSet = (item.optionSets ?? []).find((os) => os.options.length > 0);
  if (sizeSet && sizeSet.options.length >= 2) {
    const selId = selectedOptionIds[sizeSet.id] ?? sizeSet.options[0].id;
    const opt = sizeSet.options.find((o) => o.id === selId) ?? sizeSet.options[0];
    const portion = tField(opt, "portion", locale).trim();
    return portion || tField(opt, "name", locale, opt.name).trim();
  }
  return tField(item, "portion", locale).trim();
}
