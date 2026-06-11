"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useI18n, type Locale } from "@/lib/i18n";

/**
 * Wolt-style menu-language layer, independent of the system/UI language.
 *
 * The UI language (lib/i18n) drives chrome strings and page direction. Menu
 * CONTENT (item names, descriptions, groups, modifiers…) defaults to the
 * restaurant's original language; the guest opts into machine translation via
 * a banner, and the choice is remembered per restaurant in localStorage.
 *
 * `menuLocale` is what entity content must be resolved with (via tField):
 *   - choice "translated"        → the current UI locale
 *   - choice "original" / unset  → the restaurant's source locale
 *   - source locale unknown (old API payloads) → UI locale (legacy behavior)
 */
export type MenuLanguageChoice = "unset" | "original" | "translated";

type MenuLanguageContextValue = {
  /** Locale to pass to tField() for menu content. */
  menuLocale: Locale;
  /** The restaurant's authoring language, when known. */
  sourceLocale: Locale | null;
  choice: MenuLanguageChoice;
  setChoice: (c: Exclude<MenuLanguageChoice, "unset">) => void;
  /** True when the translate-offer banner should show (UI ≠ source, no choice yet). */
  offerTranslation: boolean;
  /** True when UI ≠ source and a choice exists (slim toggle state). */
  canToggle: boolean;
  /** Pages with restaurant data call this once to scope persistence + source. */
  configure: (restaurantId: number, sourceLocale?: string) => void;
};

const MenuLanguageContext = createContext<MenuLanguageContextValue | undefined>(undefined);

const SUPPORTED: Locale[] = ["en", "he", "fr"];
const storageKey = (restaurantId: number) => `foody.menu-lang.${restaurantId}`;

function asLocale(v: string | undefined | null): Locale | null {
  return v && SUPPORTED.includes(v as Locale) ? (v as Locale) : null;
}

export const MenuLanguageProvider = ({ children }: { children: ReactNode }) => {
  const { locale: uiLocale } = useI18n();
  const [restaurantId, setRestaurantId] = useState<number | null>(null);
  const [sourceLocale, setSourceLocale] = useState<Locale | null>(null);
  const [choice, setChoiceState] = useState<MenuLanguageChoice>("unset");

  const configure = useCallback((rid: number, source?: string) => {
    setRestaurantId(rid);
    setSourceLocale(asLocale(source));
  }, []);

  // Load the stored choice whenever the restaurant scope changes.
  useEffect(() => {
    if (restaurantId === null) return;
    const stored = localStorage.getItem(storageKey(restaurantId));
    setChoiceState(stored === "original" || stored === "translated" ? stored : "unset");
  }, [restaurantId]);

  const setChoice = useCallback(
    (c: Exclude<MenuLanguageChoice, "unset">) => {
      setChoiceState(c);
      if (restaurantId !== null) localStorage.setItem(storageKey(restaurantId), c);
    },
    [restaurantId],
  );

  const value = useMemo<MenuLanguageContextValue>(() => {
    // Unknown source (old API payload still cached) → behave exactly as before
    // this feature: content follows the UI locale.
    const differs = sourceLocale !== null && sourceLocale !== uiLocale;
    const menuLocale =
      sourceLocale === null ? uiLocale : choice === "translated" ? uiLocale : sourceLocale;
    return {
      menuLocale,
      sourceLocale,
      choice,
      setChoice,
      offerTranslation: differs && choice === "unset",
      canToggle: differs && choice !== "unset",
      configure,
    };
  }, [uiLocale, sourceLocale, choice, setChoice, configure]);

  return <MenuLanguageContext.Provider value={value}>{children}</MenuLanguageContext.Provider>;
};

export function useMenuLanguage(): MenuLanguageContextValue {
  const ctx = useContext(MenuLanguageContext);
  if (!ctx) throw new Error("useMenuLanguage must be used within MenuLanguageProvider");
  return ctx;
}
