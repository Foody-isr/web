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
 * Menu-language layer, layered on top of the system/UI language.
 *
 * The UI language (lib/i18n) drives chrome strings and page direction. Menu
 * CONTENT (item names, descriptions, groups, modifiers…) follows that same
 * language: picking Hebrew gives you a Hebrew menu, no extra step. A guest who
 * wants the restaurant's original wording can switch back via the toggle, and
 * that choice is remembered per restaurant in localStorage.
 *
 * `menuLocale` is what entity content must be resolved with (via tField):
 *   - choice "translated" (default) → the current UI locale
 *   - choice "original"             → the restaurant's source locale
 *   - source locale unknown (old API payloads) → UI locale
 *
 * tField() falls back to the entity's source-locale column whenever a given
 * translation is missing, so an untranslated item degrades instead of blanking.
 */
export type MenuLanguageChoice = "original" | "translated";

/**
 * Pure resolution rule behind `menuLocale`. Exported for tests and to keep the
 * decision in one place.
 */
export function resolveMenuLocale(
  uiLocale: Locale,
  sourceLocale: Locale | null,
  choice: MenuLanguageChoice,
): Locale {
  if (choice === "original" && sourceLocale !== null) return sourceLocale;
  return uiLocale;
}

type MenuLanguageContextValue = {
  /** Locale to pass to tField() for menu content. */
  menuLocale: Locale;
  /** The restaurant's authoring language, when known. */
  sourceLocale: Locale | null;
  choice: MenuLanguageChoice;
  setChoice: (c: MenuLanguageChoice) => void;
  /** True when UI ≠ source, i.e. there is an original worth toggling back to. */
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
  const [choice, setChoiceState] = useState<MenuLanguageChoice>("translated");

  const configure = useCallback((rid: number, source?: string) => {
    setRestaurantId(rid);
    setSourceLocale(asLocale(source));
  }, []);

  // Load the stored choice whenever the restaurant scope changes. Anything but
  // an explicit "original" means the menu follows the UI language.
  useEffect(() => {
    if (restaurantId === null) return;
    const stored = localStorage.getItem(storageKey(restaurantId));
    setChoiceState(stored === "original" ? "original" : "translated");
  }, [restaurantId]);

  const setChoice = useCallback(
    (c: MenuLanguageChoice) => {
      setChoiceState(c);
      if (restaurantId !== null) localStorage.setItem(storageKey(restaurantId), c);
    },
    [restaurantId],
  );

  const value = useMemo<MenuLanguageContextValue>(
    () => ({
      menuLocale: resolveMenuLocale(uiLocale, sourceLocale, choice),
      sourceLocale,
      choice,
      setChoice,
      canToggle: sourceLocale !== null && sourceLocale !== uiLocale,
      configure,
    }),
    [uiLocale, sourceLocale, choice, setChoice, configure],
  );

  return <MenuLanguageContext.Provider value={value}>{children}</MenuLanguageContext.Provider>;
};

export function useMenuLanguage(): MenuLanguageContextValue {
  const ctx = useContext(MenuLanguageContext);
  if (!ctx) throw new Error("useMenuLanguage must be used within MenuLanguageProvider");
  return ctx;
}
