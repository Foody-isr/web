"use client";

import { useI18n } from "@/lib/i18n";

export function LanguageToggle() {
  const { locale, setLocale } = useI18n();

  const next = locale === "en" ? "he" : "en";
  const flag = locale === "en" ? "🇮🇱" : "🇬🇧";
  const label = locale === "en" ? "עברית" : "English";

  return (
    <button
      onClick={() => setLocale(next)}
      className="flex items-center gap-2 px-3 py-2 rounded-full bg-[var(--surface)] border border-[var(--divider)] text-sm font-medium hover:border-brand hover:bg-[var(--surface-subtle)] transition shadow-sm"
    >
      <span className="text-base">{flag}</span>
      <span className="text-[var(--text)]">{label}</span>
    </button>
  );
}
