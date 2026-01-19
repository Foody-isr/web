"use client";

import { useI18n } from "@/lib/i18n";

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();

  const next = locale === "en" ? "he" : "en";

  return (
    <button
      onClick={() => setLocale(next)}
      className="px-3 py-2 rounded-full border border-black/10 text-sm text-ink/70 hover:border-brand hover:text-ink transition bg-white/80"
    >
      {t("changeLanguage")}: {next.toUpperCase()}
    </button>
  );
}
