"use client";

import { Bars3Icon, CalendarDaysIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useMenuLanguage } from "@/lib/menu-language";
import { websiteOrderCopy } from "@/lib/websiteOrder";
import type { Restaurant } from "@/lib/types";
import type { WebsiteOrderSelection } from "@/store/useWebsiteOrderStore";

type Mode = WebsiteOrderSelection["orderType"];
const languages = { fr: "Français", he: "עברית", en: "English" } as const;

/** Keeps the restaurant identity and language menu consistent across entry steps. */
export function WebsiteOrderEntryHeader({ restaurant, onInfo }: { restaurant: Restaurant; onInfo?: () => void }) {
  const { locale, t } = useI18n();
  return (
    <header className="website-order-entry-brand">
      <details className="website-order-entry-nav">
        <summary aria-label={t("navPrimary")}><Bars3Icon aria-hidden="true" /><span>{locale === "he" ? "תפריט" : "Menu"}</span></summary>
        <div><WebsiteOrderLanguages />{onInfo && <button type="button" onClick={onInfo}>{websiteOrderCopy(locale).info}</button>}</div>
      </details>
      <span>{restaurant.logoUrl ? <img src={restaurant.logoUrl} alt={restaurant.name} /> : restaurant.name}</span>
    </header>
  );
}

/** A dedicated storefront step that offers only the restaurant's available services. */
export function WebsiteOrderEntry({ modes, onChoose }: {
  modes: readonly Mode[];
  onChoose: (mode: Mode) => void;
}) {
  const { locale } = useI18n();
  const copy = websiteOrderCopy(locale);
  return (
    <section className="website-order-entry" aria-labelledby="website-order-entry-title">
      <h1 id="website-order-entry-title">{copy.startOrder}</h1>
      <div className="website-order-entry-options">
        {(["delivery", "pickup"] as const).filter(mode => modes.includes(mode)).map(mode => (
            <button type="button" key={mode} onClick={() => onChoose(mode)}>
              <ServiceIllustration mode={mode} />
              <strong>{copy[mode]}</strong>
            </button>
        ))}
      </div>
    </section>
  );
}

function ServiceIllustration({ mode }: { mode: Mode }) {
  return (
    <svg className="website-order-entry-illustration" viewBox="0 0 160 116" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
      {mode === "pickup" ? <>
        <path d="M27 106h108M39 106V56h82v50" fill="var(--surface)" />
        <path d="M51 69h30v23H51zM94 106V69h15v37" />
        <path d="M33 43h94l9 18a10 10 0 0 1-18 3 10 10 0 0 1-19 0 10 10 0 0 1-19 0 10 10 0 0 1-19 0 10 10 0 0 1-19 0 10 10 0 0 1-18-3z" fill="var(--order-illustration-fill)" />
        <path d="m45 61 8-18m9 18 5-18m14 18V43m19 18-5-18m23 18-8-18M80 42v-7" />
        <circle cx="80" cy="22" r="14" fill="var(--surface)" /><path d="M75 22h10m-5-5v10" />
      </> : <>
        <path d="M20 100h123M14 56h18m-12 13h13m-15 14h10" />
        <circle cx="48" cy="91" r="13" fill="var(--surface)" /><circle cx="122" cy="91" r="13" fill="var(--surface)" />
        <path d="M32 86c2-13 10-20 25-20h25l-5 19h23l12-25h10l7 26h-17l-10 10H65c-2-11-10-17-17-17-6 0-10 3-13 7z" fill="var(--order-illustration-fill)" />
        <path d="m113 61-9-22H92m26 8h8a6 6 0 0 1 0 12h-9M52 66h31" />
        <path d="M38 36h39v30H38z" fill="var(--surface)" /><path d="M38 47h39m-26-11v30m14-30v30" />
      </>}
    </svg>
  );
}

/** Keeps the confirmed scheduled date visible while the customer browses. */
export function WebsitePreorderReminder({ slot }: { slot: string }) {
  const { locale } = useI18n();
  const copy = websiteOrderCopy(locale);
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <aside className="website-preorder-reminder" aria-label={copy.preorderReminder}>
      <CalendarDaysIcon aria-hidden="true" />
      <div>
        <strong>{copy.preorderReminder}</strong>
        <p>{copy.preorderCheckDate} <bdi>{slot}</bdi></p>
      </div>
      <button type="button" onClick={() => setDismissed(true)} aria-label={copy.close}><XMarkIcon aria-hidden="true" /></button>
    </aside>
  );
}

/** Places the storefront language settings in the main navigation. */
export function WebsiteOrderLanguages() {
  const { locale, setLocale, t } = useI18n();
  const { canToggle, choice, setChoice, sourceLocale } = useMenuLanguage();
  return (
    <details className="website-order-language-menu">
      <summary>{t("changeLanguage")} · {languages[locale]}</summary>
      {(["fr", "he", "en"] as const).map(language => (
        <button key={language} type="button" lang={language} aria-pressed={language === locale} onClick={() => {
          setChoice("translated");
          setLocale(language);
        }}>{languages[language]}</button>
      ))}
      {canToggle && <button type="button" onClick={() => setChoice(choice === "original" ? "translated" : "original")}>
        {choice === "original" ? t("menuLangTranslateTo").replace("{target}", languages[locale]) : t("menuLangShowOriginal").replace("{source}", sourceLocale ? languages[sourceLocale] : "")}
      </button>}
    </details>
  );
}
