export type ChainOrderEntryLocaleCopy = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  pickup?: string;
  delivery?: string;
  search?: string;
  nearMe?: string;
  branches?: string;
  orderHere?: string;
};

export type ChainOrderEntryAppearance = {
  layout: "list" | "cards";
  showSearch: boolean;
  showNearMe: boolean;
  showBranchCount: boolean;
  showBranchNumbers: boolean;
  surfaceColor: string;
  overlayOpacity: number;
  translations: Partial<Record<"en" | "fr" | "he", ChainOrderEntryLocaleCopy>>;
};

const DEFAULT_APPEARANCE: ChainOrderEntryAppearance = {
  layout: "list",
  showSearch: true,
  showNearMe: true,
  showBranchCount: true,
  showBranchNumbers: true,
  surfaceColor: "#18181a",
  overlayOpacity: 78,
  translations: {},
};

/** Normalizes the extensible Website V3 page override used by the chain selector. */
export function resolveChainOrderEntryAppearance(
  pageAppearance: Record<string, unknown> | null | undefined,
): ChainOrderEntryAppearance {
  const source = record(pageAppearance?.chain_order_entry);
  const translations = record(source.translations);
  return {
    layout: source.layout === "cards" ? "cards" : "list",
    showSearch: booleanOr(source.show_search, true),
    showNearMe: booleanOr(source.show_near_me, true),
    showBranchCount: booleanOr(source.show_branch_count, true),
    showBranchNumbers: booleanOr(source.show_branch_numbers, true),
    surfaceColor:
      nonEmptyString(source.surface_color) ?? DEFAULT_APPEARANCE.surfaceColor,
    overlayOpacity: boundedNumber(
      source.overlay_opacity,
      0,
      100,
      DEFAULT_APPEARANCE.overlayOpacity,
    ),
    translations: {
      en: localeCopy(translations.en),
      fr: localeCopy(translations.fr),
      he: localeCopy(translations.he),
    },
  };
}

function localeCopy(value: unknown): ChainOrderEntryLocaleCopy | undefined {
  const source = record(value);
  const copy: ChainOrderEntryLocaleCopy = {};
  for (const key of [
    "eyebrow",
    "title",
    "subtitle",
    "pickup",
    "delivery",
    "search",
    "nearMe",
    "branches",
    "orderHere",
  ] as const) {
    const text = nonEmptyString(source[key]);
    if (text) copy[key] = text;
  }
  return Object.keys(copy).length > 0 ? copy : undefined;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function boundedNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}
