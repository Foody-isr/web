"use client";

import { useI18n } from "@/lib/i18n";
import { useMenuLanguage } from "@/lib/menu-language";

/**
 * Wolt-style menu-translation prompt + toggle.
 *
 *   • First visit with UI language ≠ menu source language: a banner offering a
 *     machine translation ("This menu is in Hebrew. Would you like to view a
 *     machine translation in English?") with Translate / Not now.
 *   • After a choice: a slim one-line control in the same spot so the guest
 *     can flip between original and translated anytime.
 *   • Renders nothing when the UI language matches the menu's source language
 *     (or the source language is unknown — older API payloads).
 */
export function MenuTranslateBanner() {
  const { t, locale } = useI18n();
  const { sourceLocale, choice, setChoice, offerTranslation, canToggle } = useMenuLanguage();

  if (!offerTranslation && !canToggle) return null;

  const langName = (l: string) => t(`langName_${l}`) || l;
  const source = langName(sourceLocale ?? "");
  const target = langName(locale);

  if (offerTranslation) {
    return (
      <div className="px-4 sm:px-6 lg:px-10 pb-5">
        <div className="rounded-xl bg-[var(--surface-subtle)] p-4">
          <p className="text-[13.5px] text-[var(--text)]">
            {(t("menuLangBannerText") ||
              "This menu is in {source}. Would you like to view a machine translation in {target}?")
              .replace("{source}", source)
              .replace("{target}", target)}
          </p>
          <div className="flex items-center gap-6 mt-3">
            <button
              onClick={() => setChoice("translated")}
              className="text-[14px] font-bold text-[var(--brand)] active:opacity-70 transition"
            >
              {t("menuLangTranslate") || "Translate"}
            </button>
            <button
              onClick={() => setChoice("original")}
              className="text-[14px] font-semibold text-[var(--text-muted)] active:opacity-70 transition"
            >
              {t("menuLangNotNow") || "Not now"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Slim toggle line — same spot the banner occupied.
  const translated = choice === "translated";
  return (
    <div className="px-4 sm:px-6 lg:px-10 pb-4 flex items-center gap-2 text-[12.5px] text-[var(--text-muted)]">
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
          ? t("menuLangShowOriginal") || "Show original"
          : (t("menuLangTranslateTo") || "Translate to {target}").replace("{target}", target)}
      </button>
    </div>
  );
}
