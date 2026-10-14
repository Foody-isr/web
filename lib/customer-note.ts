import type { CartLine, CustomerNoteConfig } from "./types";

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
export function cartCustomerNotes(line: CartLine): string[] {
  const notes: string[] = [];
  for (const modifier of line.modifiers ?? []) {
    if (modifier.note?.trim())
      notes.push(`${modifier.name}: ${modifier.note.trim()}`);
  }
  if (line.selectedVariantNote?.trim())
    notes.push(
      `${line.selectedVariantName ?? ""}: ${line.selectedVariantNote.trim()}`,
    );
  return notes;
}
