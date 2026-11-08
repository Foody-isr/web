"use client";

import { TruckIcon, CalendarDaysIcon, BuildingStorefrontIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useMenuLanguage } from "@/lib/menu-language";
import { websiteOrderCopy } from "@/lib/websiteOrder";
import type { Restaurant } from "@/lib/types";
import type { WebsiteOrderSelection } from "@/store/useWebsiteOrderStore";

type Mode = WebsiteOrderSelection["orderType"];
const languages = { fr: "Français", he: "עברית", en: "English" } as const;

/** A dedicated storefront step that offers only the restaurant's available services. */
export function WebsiteOrderEntry({ restaurant, modes, onChoose }: {
  restaurant: Restaurant;
  modes: readonly Mode[];
  onChoose: (mode: Mode) => void;
}) {
  const { locale } = useI18n();
  const copy = websiteOrderCopy(locale);
  return (
    <section className="website-order-entry" aria-labelledby="website-order-entry-title">
      <header className="website-order-entry-brand">
        <span>{restaurant.logoUrl ? <img src={restaurant.logoUrl} alt={restaurant.name} /> : restaurant.name}</span>
        <WebsiteOrderLanguages />
      </header>
      <h1 id="website-order-entry-title">{copy.startOrder}</h1>
      <div className="website-order-entry-options">
        {(["delivery", "pickup"] as const).filter(mode => modes.includes(mode)).map(mode => {
          const Icon = mode === "delivery" ? TruckIcon : BuildingStorefrontIcon;
          return (
            <button type="button" key={mode} onClick={() => onChoose(mode)}>
              <span className="website-order-entry-illustration" aria-hidden="true"><Icon strokeWidth={1.45} /></span>
              <strong>{copy[mode]}</strong>
              <span>{mode === "pickup" ? copy.pickupCard : copy.deliveryCard}</span>
            </button>
          );
        })}
      </div>
    </section>
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
