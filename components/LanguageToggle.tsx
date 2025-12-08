"use client";

import { useI18n } from "@/lib/i18n";

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();

  const next = locale === "en" ? "he" : "en";

  return (
    <button
      onClick={() => setLocale(next)}
      className="px-3 py-2 rounded-full border border-slate-200 text-sm hover:border-brand hover:text-brand transition"
    >
      {t("changeLanguage")}: {next.toUpperCase()}
    </button>
  );
}
