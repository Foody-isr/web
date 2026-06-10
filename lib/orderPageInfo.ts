// Helpers for order-page info placement (metadata bar + "Plus" modal).
// Shared by the API mapper, RestaurantHero (bar), and InfoScreen (modal).

import type {
  OrderPageInfo,
  OrderPageBarItem,
  OrderPageModalSection,
  OrderType,
} from "./types";

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
];

/** Default bar items when no config is set — matches today's behavior (social off). */
const DEFAULT_BAR: OrderPageBarItem[] = [
  "batch_week",
  "hours",
  "min_order",
  "fulfilment_time",
  "wifi",
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

/** Defensive parse of the raw server jsonb (snake_case) into OrderPageInfo. */
export function parseOrderPageInfo(raw: unknown): OrderPageInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const bar = (r.bar && typeof r.bar === "object" ? r.bar : {}) as Record<string, unknown>;
  return {
    bar: {
      pickup: strArr(bar.pickup) as OrderPageBarItem[],
      delivery: strArr(bar.delivery) as OrderPageBarItem[],
      dine_in: strArr(bar.dine_in) as OrderPageBarItem[],
    },
    modal: strArr(r.modal) as OrderPageModalSection[],
    modalText: typeof r.modal_text === "string" ? r.modal_text : "",
  };
}
