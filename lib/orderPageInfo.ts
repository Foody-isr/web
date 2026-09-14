// Helpers for order-page info placement (metadata bar + "Plus" modal).
// Shared by the API mapper, RestaurantHero (bar), and InfoScreen (modal).

import type {
  OrderPageInfo,
  OrderPageBarItem,
  OrderPageModalSection,
  OrderPageNavigation,
  OrderPageNavigationAppearance,
  OrderPageNavigationStyle,
  OrderType,
} from "./types";
import type { SiteNavItem } from "./siteNav";

/** Canonical render order for bar items (toggles only — no per-restaurant reorder). */
export const BAR_ITEM_ORDER: OrderPageBarItem[] = [
  "batch_week",
  "hours",
  "min_order",
  "fulfilment_time",
  "wifi",
  "instagram",
  "whatsapp",
  "facebook",
  "tiktok",
  "more",
];

/** Default bar items when no config is set — matches today's behavior (social off, Plus on). */
const DEFAULT_BAR: OrderPageBarItem[] = [
  "batch_week",
  "hours",
  "min_order",
  "fulfilment_time",
  "wifi",
  "more",
];

export const MODAL_SECTION_ORDER: OrderPageModalSection[] = [
  "about",
  "hours",
  "address",
  "contact",
  "social",
  "custom_text",
];

/** Default modal sections when no config is set — matches today's InfoScreen. */
const DEFAULT_MODAL: OrderPageModalSection[] = [
  "about",
  "hours",
  "address",
  "contact",
  "social",
];

/** Enabled bar item keys for a mode (config or default), in canonical order. */
export function barItemsForMode(
  info: OrderPageInfo | null | undefined,
  mode: OrderType | undefined,
): OrderPageBarItem[] {
  const enabled = (mode ? info?.bar?.[mode] : undefined) ?? DEFAULT_BAR;
  return BAR_ITEM_ORDER.filter((k) => enabled.includes(k));
}

/** Enabled modal sections (config or default), in canonical order. */
export function modalSectionsFor(
  info: OrderPageInfo | null | undefined,
): OrderPageModalSection[] {
  const enabled = info?.modal ?? DEFAULT_MODAL;
  return MODAL_SECTION_ORDER.filter((k) => enabled.includes(k));
}

const NAVIGATION_STYLES: OrderPageNavigationStyle[] = [
  "hidden",
  "inline",
  "buttons",
  "banner",
];

/** Returns the configured order-page navigation bridge, or null for the legacy layout. */
export function navigationFor(
  info: OrderPageInfo | null | undefined,
): OrderPageNavigation | null {
  return info?.navigation ?? null;
}

/** Page-backed destinations eligible for promotion from an order page. */
export function orderPageDestinationItems(items: SiteNavItem[]): SiteNavItem[] {
  return items.filter((item) => item.pageType !== "order");
}

/** Resolves the directly promoted page without ever fabricating a broken link. */
export function featuredOrderPageDestination(
  navigation: OrderPageNavigation | null | undefined,
  items: SiteNavItem[],
): SiteNavItem | null {
  const slug = navigation?.featuredPageSlug?.trim();
  if (!slug) return null;
  return orderPageDestinationItems(items).find((item) => item.key === slug) ?? null;
}

/** Resolves the exact configured Discover list in the canonical navigation order. */
export function discoverOrderPageDestinations(
  navigation: OrderPageNavigation | null | undefined,
  items: SiteNavItem[],
): SiteNavItem[] {
  if (!navigation?.discoverEnabled) return [];
  const enabled = new Set(navigation.discoverPageSlugs);
  return orderPageDestinationItems(items).filter((item) => enabled.has(item.key));
}

/** Defensive parse of the raw server jsonb (snake_case) into OrderPageInfo. */
export function parseOrderPageInfo(raw: unknown): OrderPageInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const bar = (r.bar && typeof r.bar === "object" ? r.bar : {}) as Record<string, unknown>;
  const navigation = parseNavigation(r.navigation);
  return {
    bar: {
      pickup: strArr(bar.pickup) as OrderPageBarItem[],
      delivery: strArr(bar.delivery) as OrderPageBarItem[],
      dine_in: strArr(bar.dine_in) as OrderPageBarItem[],
    },
    modal: strArr(r.modal) as OrderPageModalSection[],
    modalText:
      typeof r.modal_text === "string"
        ? r.modal_text
        : typeof r.modalText === "string"
          ? r.modalText
          : "",
    ...(navigation ? { navigation } : {}),
  };
}

function parseNavigation(raw: unknown): OrderPageNavigation | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const style = (snake: string, camel: string): OrderPageNavigationStyle => {
    const candidate = value[snake] ?? value[camel];
    return typeof candidate === "string" &&
      NAVIGATION_STYLES.includes(candidate as OrderPageNavigationStyle)
      ? (candidate as OrderPageNavigationStyle)
      : "hidden";
  };
  const text = (snake: string, camel: string): string | undefined => {
    const candidate = value[snake] ?? value[camel];
    return typeof candidate === "string" ? candidate : undefined;
  };
  const rawSlugs = value.discover_page_slugs ?? value.discoverPageSlugs;
  const appearance = parseNavigationAppearance(value.appearance);
  return {
    desktopStyle: style("desktop_style", "desktopStyle"),
    mobileStyle: style("mobile_style", "mobileStyle"),
    featuredPageSlug: text("featured_page_slug", "featuredPageSlug"),
    featuredLabel: text("featured_label", "featuredLabel"),
    featuredDescription: text(
      "featured_description",
      "featuredDescription",
    ),
    discoverEnabled:
      (value.discover_enabled ?? value.discoverEnabled) === true,
    discoverLabel: text("discover_label", "discoverLabel"),
    discoverPageSlugs: Array.isArray(rawSlugs)
      ? rawSlugs.filter((entry): entry is string => typeof entry === "string")
      : [],
    ...(appearance ? { appearance } : {}),
  };
}

function parseNavigationAppearance(
  raw: unknown,
): OrderPageNavigationAppearance | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const text = (snake: string, camel: string): string | undefined => {
    const candidate = value[snake] ?? value[camel];
    return typeof candidate === "string" ? candidate : undefined;
  };
  const number = (
    snake: string,
    camel: string,
    min: number,
    max: number,
  ): number | undefined => {
    const candidate = value[snake] ?? value[camel];
    return typeof candidate === "number" && Number.isFinite(candidate)
      ? Math.min(max, Math.max(min, candidate))
      : undefined;
  };
  const enumValue = <T extends string>(
    snake: string,
    camel: string,
    allowed: readonly T[],
  ): T | undefined => {
    const candidate = value[snake] ?? value[camel];
    return typeof candidate === "string" && allowed.includes(candidate as T)
      ? candidate as T
      : undefined;
  };

  return {
    surfaceColor: text("surface_color", "surfaceColor"),
    textColor: text("text_color", "textColor"),
    mutedTextColor: text("muted_text_color", "mutedTextColor"),
    borderColor: text("border_color", "borderColor"),
    buttonBackgroundColor: text(
      "button_background_color",
      "buttonBackgroundColor",
    ),
    buttonTextColor: text("button_text_color", "buttonTextColor"),
    buttonBorderColor: text("button_border_color", "buttonBorderColor"),
    shape: enumValue("shape", "shape", ["square", "soft", "rounded", "pill"]),
    shadow: enumValue("shadow", "shadow", ["none", "soft", "strong"]),
    fontFamily: text("font_family", "fontFamily"),
    fontWeight: number("font_weight", "fontWeight", 100, 900),
    labelFontSizeDesktop: number(
      "label_font_size_desktop",
      "labelFontSizeDesktop",
      10,
      24,
    ),
    labelFontSizeMobile: number(
      "label_font_size_mobile",
      "labelFontSizeMobile",
      10,
      24,
    ),
    descriptionFontSizeDesktop: number(
      "description_font_size_desktop",
      "descriptionFontSizeDesktop",
      8,
      18,
    ),
    descriptionFontSizeMobile: number(
      "description_font_size_mobile",
      "descriptionFontSizeMobile",
      8,
      18,
    ),
    letterSpacing: number("letter_spacing", "letterSpacing", -1, 4),
    uppercase:
      typeof (value.uppercase) === "boolean" ? value.uppercase : undefined,
  };
}
