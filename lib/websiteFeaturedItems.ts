import type { MenuData, MenuItem } from "./types";

/** Normalizes the shared editor contract for the two featured-item sections. */
export function featuredItemsDesign(
  settings: Record<string, unknown> = {},
  menu = false,
) {
  const number = (key: string, fallback: number, min: number, max: number) => {
    const value = Number(settings[key]);
    return Number.isFinite(value) && settings[key] != null
      ? Math.min(max, Math.max(min, value))
      : fallback;
  };
  const bool = (key: string, fallback: boolean) =>
    typeof settings[key] === "boolean" ? (settings[key] as boolean) : fallback;
  return {
    columns: Math.round(number("columns", menu ? 2 : 3, 1, menu ? 2 : 4)),
    imageSize:
      settings.image_size === "S"
        ? 160
        : settings.image_size === "M"
          ? 240
          : 320,
    spacing: number("column_spacing", 2, 0, 10) * 10,
    fullWidth: bool("full_width", false),
    autoScroll: bool("auto_scroll", false),
    speed: [0.5, 1, 1.5, 2].includes(Number(settings.scroll_speed))
      ? Number(settings.scroll_speed)
      : 1,
    reverse: settings.scroll_direction === "right",
    showTitle: bool("show_title", true),
    showSubtitle: bool("show_subtitle", true),
    showSectionButton: bool("show_cta_text", bool("show_section_button", menu)),
    showImages: bool("show_images", !menu),
    showItemTitles: bool("show_item_titles", true),
    showDescriptions: bool("show_descriptions", menu),
    showPrices: bool("show_prices", true),
    showBadges: bool("show_badges", true),
    showButtons: bool("show_buttons", !menu),
    imageRatio: ["1/1", "3/2", "2/3", "4/3"].includes(
      String(settings.image_ratio),
    )
      ? String(settings.image_ratio)
      : "1/1",
    imageFit:
      settings.image_fit === "contain"
        ? ("contain" as const)
        : ("cover" as const),
    maxItems: Math.round(number("max_items", 10, 1, 12)),
  };
}

/** Restricts featured selections to visible public menu groups, never internal categories. */
export function featuredEligibleItems(menus: MenuData[]): MenuItem[] {
  const items = new Map<string, MenuItem>();
  for (const menu of menus) {
    if (menu.tour) continue;
    const groups = new Set(menu.groups.map((group) => String(group.id)));
    for (const item of menu.items) {
      if (
        !groups.has(String(item.groupId)) ||
        item.comboOnly ||
        item.availabilityState === "hidden"
      )
        continue;
      if (!items.has(String(item.id))) items.set(String(item.id), item);
    }
  }
  return Array.from(items.values());
}

/** Wraps the carousel's physical scroll offset within one repeatable item sequence. */
export function featuredCarouselOffset(
  offset: number,
  distance: number,
  period: number,
): number {
  return period > 0 ? (((offset + distance) % period) + period) % period : 0;
}
