export type CategoryNavigationMode = "auto" | "horizontal" | "sidebar";
export type CategoryNavigationSide = "start" | "end";

export type CategoryNavigationConfig = {
  mode: CategoryNavigationMode;
  side: CategoryNavigationSide;
};

export const DEFAULT_CATEGORY_NAVIGATION: CategoryNavigationConfig = {
  mode: "auto",
  side: "start",
};

export const CATEGORY_SIDEBAR_AUTO_THRESHOLD = 10;

/** Sanitizes the extensible Website V3 appearance value into a stable contract. */
export function normalizeCategoryNavigation(
  value: unknown,
): CategoryNavigationConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_CATEGORY_NAVIGATION;
  }

  const record = value as Record<string, unknown>;
  return {
    mode: isCategoryNavigationMode(record.mode)
      ? record.mode
      : DEFAULT_CATEGORY_NAVIGATION.mode,
    side: isCategoryNavigationSide(record.side)
      ? record.side
      : DEFAULT_CATEGORY_NAVIGATION.side,
  };
}

/** Auto switches catalogue-like menus to a sidebar once scanning tabs is costly. */
export function usesCategorySidebar(
  config: CategoryNavigationConfig,
  visibleGroupCount: number,
): boolean {
  return (
    config.mode === "sidebar" ||
    (config.mode === "auto" &&
      visibleGroupCount >= CATEGORY_SIDEBAR_AUTO_THRESHOLD)
  );
}

/** Resolves logical start/end to the physical side for the current locale. */
export function isCategorySidebarOnLeft(
  side: CategoryNavigationSide,
  direction: "ltr" | "rtl",
): boolean {
  return side === "start" ? direction === "ltr" : direction === "rtl";
}

function isCategoryNavigationMode(
  value: unknown,
): value is CategoryNavigationMode {
  return value === "auto" || value === "horizontal" || value === "sidebar";
}

function isCategoryNavigationSide(
  value: unknown,
): value is CategoryNavigationSide {
  return value === "start" || value === "end";
}
