"use client";

import { useI18n } from "@/lib/i18n";

export function LanguageToggle() {
  const { locale, setLocale } = useI18n();

  const locales = ["en", "he", "fr"] as const;
  const currentIndex = locales.indexOf(locale);
  const next = locales[(currentIndex + 1) % locales.length];

  const flags: Record<string, string> = { en: "🇬🇧", he: "🇮🇱", fr: "🇫🇷" };
  const labels: Record<string, string> = { en: "English", he: "עברית", fr: "Français" };

  return (
    <button
      onClick={() => setLocale(next)}
      className="flex items-center gap-2 px-3 py-2 rounded-full bg-[var(--surface)] border border-[var(--divider)] text-sm font-medium hover:border-brand hover:bg-[var(--surface-subtle)] transition shadow-sm"
    >
      <span className="text-base">{flags[locale]}</span>
      <span className="text-[var(--text)]">{labels[locale]}</span>
    </button>
  );
}
