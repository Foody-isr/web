import type { Locale } from "./i18n";
import { tField } from "./translations";
import type { MenuItem } from "./types";

/**
 * Serving-size label shown under an item's title in the item modal, following
 * the customer's current size selection.
 *
 * The modal lets the customer pick a size via the item's primary option set —
 * the first set that has options, which is also the one that drives the
 * displayed price. When that set offers a real choice (2+ options) we surface
 * the SELECTED option's size: its `portion` field when filled, otherwise its
 * name (this restaurant encodes sizes in the option name, e.g. "250g"/"500g",
 * leaving the portion field empty). The label updates live as the selection
 * changes, so it can never contradict the chosen size the way a fixed
 * item-level portion can.
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
