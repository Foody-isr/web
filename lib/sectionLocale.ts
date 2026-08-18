import { WebsiteSection } from "@/lib/types";

/**
 * Apply a website section's per-locale text overrides on render. The server
 * stores translations keyed by a content field-path ("headline", "cards.0.title")
 * -> locale -> value; here we set those paths on a copy of the content for the
 * active locale. Missing translations (or the source locale) fall through to the
 * original text. Only existing paths are overwritten — never created — so a
 * stale translation for a removed card can't reintroduce it.
 */

function setPath(root: Record<string, unknown>, path: string, value: string): void {
  const parts = path.split(".");
  let cur: unknown = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const raw = parts[i];
    const key = /^\d+$/.test(raw) ? Number(raw) : raw;
    if (cur == null || typeof cur !== "object") return;
    const next = (cur as Record<string | number, unknown>)[key];
    if (next == null || typeof next !== "object") return;
    cur = next;
  }
  const lastRaw = parts[parts.length - 1];
  const last = /^\d+$/.test(lastRaw) ? Number(lastRaw) : lastRaw;
  if (cur && typeof cur === "object" && last in (cur as object)) {
    (cur as Record<string | number, unknown>)[last] = value;
  }
}

export function localizeContent(
  content: Record<string, unknown>,
  translations: Record<string, Record<string, string>> | undefined,
  locale: string,
): Record<string, unknown> {
  if (!translations || !locale) return content;
  let out = content;
  let cloned = false;
  for (const [path, byLocale] of Object.entries(translations)) {
    const val = byLocale?.[locale];
    if (!val) continue;
    if (!cloned) {
      out = JSON.parse(JSON.stringify(content));
      cloned = true;
    }
    setPath(out, path, val);
  }
  return out;
}

/** Return the section with its content localized to `locale` (or unchanged). */
export function localizeSection(section: WebsiteSection, locale: string): WebsiteSection {
  if (!section.translations) return section;
  const content = localizeContent(section.content, section.translations, locale);
  return content === section.content ? section : { ...section, content };
}
