import type { MenuItem, OptionSelection, OptionSetType } from "./types";
import { modifierPositionCount } from "./modifier-selection";
import { tField } from "./translations";
import type { Locale } from "./i18n";

export type OptionPosition = { key: string; set: OptionSetType; index: number; repeated: boolean };

/** Expands descriptive variant dimensions into explicit required single-choice positions. */
export function optionPositions(item: MenuItem, priceOptionIds: number[]): OptionPosition[] {
  return (item.optionSets ?? []).filter(set => set.selectionRole === "identity").flatMap(set => {
    const count = modifierPositionCount(set.selectionConfig, priceOptionIds, {});
    const repeated = !!set.selectionConfig?.choices.some(choice => choice.count > 1);
    return Array.from({ length: count }, (_, index) => ({ key: `${set.id}@${index + 1}`, set, index: index + 1, repeated }));
  });
}

/** Snapshots the cart's descriptive choices independently of its priced variant and modifiers. */
export function selectedOptionSnapshots(positions: OptionPosition[], selected: Record<string, number>, notes: Record<string, string>): OptionSelection[] {
  return positions.flatMap(position => {
    const option = position.set.options.find(choice => choice.id === selected[position.key]);
    if (!option) return [];
    const suffix = position.repeated ? ` ${position.index}` : "";
    return [{ optionSetId: position.set.id, optionId: option.id, selectionIndex: position.index, name: option.name,
      groupName: position.set.name + suffix, translations: option.translations,
      groupTranslations: { ...position.set.translations, name: Object.fromEntries(Object.entries(position.set.translations?.name ?? {}).map(([locale, name]) => [locale, name ? name + suffix : ""])) },
      noteLabel: option.customerNote?.label, note: notes[`identity-${position.key}`]?.trim() || undefined }];
  });
}

/** Localizes the persisted cart option labels without looking up mutable catalog data. */
export function optionSelectionLabels(selections: OptionSelection[] | undefined, locale: Locale): string[] {
  return (selections ?? []).flatMap(selection => [
    `${tField({ translations: selection.groupTranslations }, "name", locale, selection.groupName)}: ${tField(selection, "name", locale, selection.name)}`,
    ...(selection.note ? [selection.noteLabel ? `${selection.noteLabel}: ${selection.note}` : selection.note] : []),
  ]);
}
