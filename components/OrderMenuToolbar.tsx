"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  CheckIcon,
  ChevronLeftIcon,
  LanguageIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useI18n, type Locale } from "@/lib/i18n";
import { useMenuLanguage } from "@/lib/menu-language";
import { useRestaurantIdentityHidden } from "@/lib/useRestaurantIdentityHidden";

const languages: Array<{ locale: Locale; name: string }> = [
  { locale: "en", name: "English" },
  { locale: "he", name: "עברית" },
  { locale: "fr", name: "Français" },
];

/** Shared order search and anchored Translate action, using the existing locale preferences. */
export function OrderMenuToolbar({
  backHref,
  restaurantName,
  search,
}: {
  backHref?: string;
  restaurantName?: string;
  search?: {
    value: string;
    onChange: (value: string) => void;
    label: string;
    placeholder: string;
  };
}) {
  const { locale, setLocale, direction, t } = useI18n();
  const { setChoice } = useMenuLanguage();
  const toolbar = useRef<HTMLDivElement>(null);
  const identityHidden = useRestaurantIdentityHidden(toolbar, restaurantName);
  const [menuOpen, setMenuOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const more = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const translate = useRef<HTMLButtonElement>(null);
  const keyboardOpen = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const menuId = useId();
  const titleId = useId();

  useEffect(() => {
    if (!menuOpen) return;
    if (keyboardOpen.current) translate.current?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      if (!more.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setMenuOpen(false);
      trigger.current?.focus({ preventScroll: true });
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [menuOpen]);

  useEffect(() => {
    const element = dialog.current;
    if (!languageOpen || !element) return;
    const previous = trigger.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      previous?.focus({ preventScroll: true });
    };
  }, [languageOpen]);

  return (
    <div ref={toolbar} className="order-menu-toolbar" dir="ltr">
      {backHref && (
        <a
          className="order-menu-round order-menu-back"
          href={backHref}
          aria-label={t("back")}
        >
          <ChevronLeftIcon aria-hidden="true" />
        </a>
      )}
      {search ? (
        <div className="order-menu-search">
          <MagnifyingGlassIcon aria-hidden="true" />
          <input
            type="search"
            enterKeyHint="search"
            dir="auto"
            aria-label={search.label}
            placeholder={identityHidden && restaurantName ? restaurantName : search.placeholder}
            value={search.value}
            onChange={(event) => search.onChange(event.target.value)}
          />
        </div>
      ) : (
        <div className="flex-1" />
      )}
      <div
        className="order-menu-more"
        ref={more}
        onBlur={(event) => {
          // Safari can blur a focused button to the document on a pointer click.
          // Outside pointers are handled separately; only close for a real focus target.
          if (
            event.relatedTarget &&
            !event.currentTarget.contains(event.relatedTarget)
          )
            setMenuOpen(false);
        }}
      >
        <button
          ref={trigger}
          className="order-menu-round"
          type="button"
          aria-label={t("orderMenuMore")}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={(event) => {
            keyboardOpen.current = event.detail === 0;
            setMenuOpen((open) => !open);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              keyboardOpen.current = true;
              if (menuOpen) translate.current?.focus({ preventScroll: true });
              setMenuOpen(true);
            }
          }}
        >
          {menuOpen ? (
            <XMarkIcon aria-hidden="true" />
          ) : (
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="1.75" />
              <circle cx="12" cy="12" r="1.75" />
              <circle cx="19" cy="12" r="1.75" />
            </svg>
          )}
        </button>
        {menuOpen && (
          <div
            id={menuId}
            role="menu"
            aria-label={t("orderMenuMore")}
            className="order-menu-dropdown"
            dir={direction}
            onKeyDown={(event) => {
              if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key))
                event.preventDefault();
            }}
          >
            <button
              ref={translate}
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setLanguageOpen(true);
              }}
            >
              <LanguageIcon aria-hidden="true" />
              <span>{t("translateMenu")}</span>
            </button>
          </div>
        )}
      </div>
      <dialog
        ref={dialog}
        className="order-menu-language-dialog"
        aria-labelledby={titleId}
        dir={direction}
        onCancel={() => setLanguageOpen(false)}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            setLanguageOpen(false);
        }}
      >
        <div className="order-menu-language-heading">
          <h2 id={titleId}>{t("changeLanguage")}</h2>
          <button
            className="order-menu-round"
            type="button"
            aria-label={t("close")}
            onClick={() => setLanguageOpen(false)}
          >
            <XMarkIcon aria-hidden="true" />
          </button>
        </div>
        <div role="group" aria-labelledby={titleId}>
          {languages.map((language) => (
            <button
              key={language.locale}
              type="button"
              className="order-menu-language-option"
              aria-pressed={locale === language.locale}
              lang={language.locale}
              autoFocus={locale === language.locale}
              onClick={() => {
                setChoice("translated");
                setLocale(language.locale);
                setLanguageOpen(false);
              }}
            >
              <span dir="auto">{language.name}</span>
              {locale === language.locale && <CheckIcon aria-hidden="true" />}
            </button>
          ))}
        </div>
      </dialog>
    </div>
  );
}
