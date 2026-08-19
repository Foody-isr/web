import type { Locale } from "@/lib/i18n";

/** Returns a "YYYY-MM-DD" string that is `days` calendar days after `date`. */
export function addDays(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Map our app locales to BCP-47 tags Intl understands.
const LOCALE_TAGS: Record<Locale, string> = {
  en: "en-US",
  fr: "fr-FR",
  he: "he-IL",
};

// "Today" / "Tomorrow" per locale — kept here so the date utils stay
// self-contained (no React context needed to format a date string).
const RELATIVE_DAY_LABELS: Record<Locale, { today: string; tomorrow: string }> = {
  en: { today: "Today", tomorrow: "Tomorrow" },
  fr: { today: "Aujourd'hui", tomorrow: "Demain" },
  he: { today: "היום", tomorrow: "מחר" },
};

function localeTag(locale: Locale): string {
  return LOCALE_TAGS[locale] ?? LOCALE_TAGS.en;
}

/**
 * Returns a human-readable label for a "YYYY-MM-DD" date string, localised to
 * `locale`: "Today", "Tomorrow", or e.g. "Mon, Feb 26" / "lun. 26 févr.".
 */
export function formatDateLabel(
  dateStr: string,
  locale: Locale = "en",
  opts?: { lowerRelative?: boolean }
): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const d = new Date(dateStr + "T00:00:00");
  const relative = RELATIVE_DAY_LABELS[locale] ?? RELATIVE_DAY_LABELS.en;
  // Relative words ("Today"/"Aujourd'hui") are capitalised for standalone use
  // (date chips). Inside a phrase ("Delivery today", "Livraison aujourd'hui")
  // they must be lowercased; weekday forms below are left untouched.
  const rel = (s: string) => (opts?.lowerRelative ? s.toLocaleLowerCase(localeTag(locale)) : s);
  if (d.getTime() === today.getTime()) return rel(relative.today);
  if (d.getTime() === tomorrow.getTime()) return rel(relative.tomorrow);
  return d.toLocaleDateString(localeTag(locale), { weekday: "short", month: "short", day: "numeric" });
}

/**
 * Returns a localised day + time label for an ISO instant, e.g. "Today 18:00"
 * or "ven. 17 juil. 11:30". Used for a delivery tour's cutoff, which is an
 * instant (not a calendar day) and is very often today or tomorrow: a round is
 * routinely opened at 11am for the same evening.
 */
export function formatCutoffLabel(
  iso: string,
  locale: Locale = "en",
  opts?: { lowerRelative?: boolean }
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Local calendar day of the instant — NOT `toISOString().slice(0, 10)`, which
  // is UTC and would name the wrong day for a late-evening cutoff.
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
  const time = d.toLocaleTimeString(localeTag(locale), { hour: "2-digit", minute: "2-digit" });
  return `${formatDateLabel(dateStr, locale, opts)} ${time}`;
}

/** Returns the localised full weekday name (e.g. "Friday" / "vendredi") for a "YYYY-MM-DD" date. */
export function formatWeekday(dateStr: string, locale: Locale = "en"): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(localeTag(locale), { weekday: "long" });
}
