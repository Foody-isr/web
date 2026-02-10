"use client";

import { useI18n } from "@/lib/i18n";

type Props = {
  variant?: "default" | "transparent";
};

export function LanguageToggle({ variant = "default" }: Props) {
  const { locale, setLocale } = useI18n();

  const locales = ["en", "he", "fr"] as const;
  const currentIndex = locales.indexOf(locale);
  const next = locales[(currentIndex + 1) % locales.length];

  const flags: Record<string, string> = { en: "🇬🇧", he: "🇮🇱", fr: "🇫🇷" };
  const labels: Record<string, string> = { en: "English", he: "עברית", fr: "Français" };

  return (
    <button
      onClick={() => setLocale(next)}
      className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition shadow-sm ${
        variant === "transparent"
          ? "bg-black/30 backdrop-blur-md text-white border border-white/20 hover:bg-black/50"
          : "bg-[var(--surface)] border border-[var(--divider)] text-[var(--text)] hover:border-brand hover:bg-[var(--surface-subtle)]"
      }`}
    >
      <span className="text-base">{flags[locale]}</span>
      <span>{labels[locale]}</span>
    </button>
  );
}
