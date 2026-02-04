"use client";

import { useI18n } from "@/lib/i18n";

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();

  const next = locale === "en" ? "he" : "en";

  return (
    <button
      onClick={() => setLocale(next)}
      className="px-3 py-2 rounded-button border border-light-divider text-sm text-ink-muted hover:border-brand hover:text-ink transition bg-light-surface font-medium"
    >
      {t("changeLanguage")}: {next.toUpperCase()}
    </button>
  );
}
