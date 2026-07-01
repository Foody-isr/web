import type { Locale } from "./i18n";

const SUPPORTED_LOCALES: Locale[] = ["en", "he", "fr"];

/** Coerce an arbitrary string (e.g. a `?lang=` param) to a supported Locale. */
export function toLocale(value: string | null | undefined): Locale {
  return value && SUPPORTED_LOCALES.includes(value as Locale) ? (value as Locale) : "en";
}

// Per-locale share sentence. `{item}` and `{restaurant}` are interpolated.
// Centralized here so the client share control AND the server-side OG
// description (generateMetadata) render identical copy. No em dash (project rule).
const SHARE_TEXT_TEMPLATES: Record<Locale, string> = {
  en: "Look at this {item} at {restaurant}",
  fr: "Regarde {item} chez {restaurant}",
  he: "תראו את {item} ב{restaurant}",
};

export function shareTextTemplate(locale: Locale): string {
  return SHARE_TEXT_TEMPLATES[locale] ?? SHARE_TEXT_TEMPLATES.en;
}

export function buildItemShareText(locale: Locale, itemName: string, restaurantName: string): string {
  return shareTextTemplate(locale)
    .replace("{item}", itemName)
    .replace("{restaurant}", restaurantName);
}

/**
 * Build a shareable deep link to a single item. Takes the CURRENT origin +
 * pathname (so it works on app.foody-pos.co.il/r/{id}/order, subdomains, and
 * custom domains like mamietlv.co.il/order alike) and sets only `item` + `lang`,
 * dropping any pre-existing query on the page.
 */
export function buildItemShareUrl(origin: string, pathname: string, itemId: string, lang: string): string {
  const u = new URL(pathname, origin);
  u.search = "";
  u.searchParams.set("item", itemId);
  u.searchParams.set("lang", lang);
  return u.toString();
}
