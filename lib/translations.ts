import type { Locale } from "./i18n";

// Server stores per-locale overrides on each entity in this shape:
//   { name: { he: "...", fr: "..." }, description: { he: "...", fr: "..." } }
// The source-locale value lives in the entity's regular column (name, etc.) —
// it is never stored here.
export type TranslationMap = Record<string, Partial<Record<Locale, string>>>;

export type TranslatableEntity = {
  translations?: TranslationMap | null;
} & Record<string, unknown>;

/**
 * Resolve a translatable field for the requested locale.
 * Falls back to the entity's source-locale value when no translation exists.
 */
export function tField(
  entity: TranslatableEntity | null | undefined,
  field: string,
  locale: Locale,
  fallback?: string
): string {
  if (!entity) return fallback ?? "";
  const translated = entity.translations?.[field]?.[locale];
  if (translated) return translated;
  const source = entity[field];
  if (typeof source === "string" && source.length > 0) return source;
  return fallback ?? "";
}
