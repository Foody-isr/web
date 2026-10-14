import type { CartLine, CustomerNoteConfig } from "./types";
import type { Locale } from "./i18n";
import { formatModifierLabel, formatSelectedVariantName } from "./cart";

/** Tests only the note belonging to the currently selected choice. */
export function customerNoteValid(
  config: CustomerNoteConfig | null | undefined,
  value?: string,
): boolean {
  if (!config?.enabled) return true;
  const text = value?.trim() ?? "";
  return (
    (!config.required || text.length > 0) && Array.from(text).length <= 500
  );
}

/** Describes selected customizations without mixing them with general instructions. */
export function cartCustomerNotes(line: CartLine, locale?: Locale): string[] {
  const notes: string[] = [];
  for (const modifier of line.modifiers ?? []) {
    if (modifier.note?.trim())
      notes.push(`${formatModifierLabel(modifier, locale)}: ${modifier.note.trim()}`);
  }
  if (line.selectedVariantNote?.trim())
    notes.push(
      [locale ? formatSelectedVariantName(line, locale) : line.selectedVariantName, line.selectedVariantNote.trim()].filter(Boolean).join(": "),
    );
  return notes;
}
