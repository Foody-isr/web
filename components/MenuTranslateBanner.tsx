"use client";

import { useI18n } from "@/lib/i18n";
import { useMenuLanguage } from "@/lib/menu-language";

/**
 * Menu-language toggle.
 *
 * The menu already renders in the guest's chosen site language. This is the way
 * back: a slim one-line control that flips between the machine translation and
 * the restaurant's original wording.
 *
 * Renders nothing when the site language matches the menu's source language
 * (or the source language is unknown — older API payloads), because then there
 * is no "original" distinct from what is already on screen.
 */
export function MenuTranslateBanner() {
  const { t, locale } = useI18n();
  const { sourceLocale, choice, setChoice, canToggle } = useMenuLanguage();

  if (!canToggle) return null;

  const langName = (l: string) => t(`langName_${l}`) || l;
  const source = langName(sourceLocale ?? "");
  const target = langName(locale);
  const translated = choice === "translated";

  // Shared rail: matches the order-type chip row (px-6 lg:px-12 on desktop)
  // so the card lines up with the chip and the category bar above it.
  return (
    <div className="px-4 sm:px-6 lg:px-12 pt-5">
      <div className="rounded-2xl bg-[var(--surface-subtle)] px-6 py-4 flex items-center gap-2 text-[14px] text-[var(--text-muted)]">
        <span>
          {translated
            ? (t("menuLangTranslated") || "Translated to {target}").replace("{target}", target)
            : (t("menuLangOriginalShown") || "Menu shown in {source}").replace("{source}", source)}
        </span>
        <span aria-hidden className="opacity-40">
          ·
        </span>
        <button
          onClick={() => setChoice(translated ? "original" : "translated")}
          className="font-semibold text-[var(--brand)] active:opacity-70 transition"
        >
          {translated
            ? (t("menuLangShowOriginal") || "Show original").replace("{source}", source)
            : (t("menuLangTranslateTo") || "Translate to {target}").replace("{target}", target)}
        </button>
      </div>
    </div>
  );
}
