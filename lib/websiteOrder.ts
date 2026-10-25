import { normalizeImageFraming } from "./imageFraming";
import { websiteMediaUrl } from "./websiteComponents";
import type { MenuData, MenuItem } from "./types";

export type WebsiteOrderDesign = ReturnType<typeof normalizeWebsiteOrder>;

/** Normalizes page-local menu design without changing restaurant fulfillment rules. */
export function normalizeWebsiteOrder(value: unknown) {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const bool = (key: string, fallback = true) =>
    typeof source[key] === "boolean" ? (source[key] as boolean) : fallback;
  const choice = <T extends string>(
    key: string,
    values: readonly T[],
    fallback: T,
  ): T =>
    values.includes(String(source[key]) as T)
      ? (String(source[key]) as T)
      : fallback;
  const text = (
    prefix: string,
    fallback: "inherit",
  ) => ({
    style: choice(
      `${prefix}_style`,
      [
        "inherit",
        "title-1",
        "title-2",
        "title-3",
        "title-4",
        "paragraph-1",
        "paragraph-2",
        "paragraph-3",
      ],
      fallback,
    ),
    alignment: choice(
      `${prefix}_alignment`,
      ["start", "center", "end"],
      "start",
    ),
    caps: bool(`${prefix}_caps`, false),
    weight: choice(
      `${prefix}_weight`,
      ["regular", "semibold", "bold"],
      String(source[`${prefix}_style`] ?? fallback).startsWith("title")
        ? "semibold"
        : "regular",
    ),
  });
  const color = (key: string) =>
    typeof source[key] === "string" && /^#[\da-f]{6}$/i.test(source[key])
      ? (source[key] as string)
      : undefined;
  const pixels = (key: string, fallback: number, maximum: number) => {
    const value = source[key];
    const numeric = typeof value === "number" || (typeof value === "string" && value.trim() !== "") ? Number(value) : NaN;
    return Number.isFinite(numeric) ? Math.max(0, Math.min(maximum, numeric)) : fallback;
  };
  const optionalPixels = (key: string, maximum: number) => {
    const value = pixels(key, Number.NaN, maximum);
    return Number.isFinite(value) ? value : undefined;
  };
  return {
    colorPreset: choice("color_preset", ["site", "wolt"], "site"),
    categoryGap: pixels("category_gap", 20, 80),
    categorySpacing: pixels("category_spacing", 48, 160),
    categoryText: text("category", "inherit"),
    categoryTitleText: text("category_title", "inherit"),
    itemTitleText: text("item_title", "inherit"),
    itemPriceText: text("item_price", "inherit"),
    itemDescriptionText: text("item_description", "inherit"),
    layout: choice(
      "layout",
      ["list", "grid", "cards", "text", "single", "rows"],
      "list",
    ),
    columns: Math.min(4, Math.max(1, Math.floor(Number(source.columns) || 2))),
    contentWidth: choice("content_width", ["standard", "wide"], "standard"),
    categoryShape: choice(
      "category_shape",
      ["plain", "underline", "rounded", "pill"],
      source.card_style === "filled" ? "pill" : "plain",
    ),
    stickyCategories: bool("sticky_categories"),
    showAvailabilityFilter: bool("show_availability_filter"),
    background:
      typeof source.background === "string" &&
      /^#[\da-f]{6}$/i.test(source.background)
        ? source.background
        : undefined,
    colorStyle: choice(
      "color_style",
      [
        "default",
        "light",
        "dark",
        "accent",
        "surface",
        "soft",
        "style-1",
        "style-2",
        "style-3",
        "style-4",
        "style-5",
        "style-6",
      ],
      "default",
    ),
    backgroundKind: choice(
      "background_kind",
      ["style", "color", "gradient", "image"],
      "style",
    ),
    backgroundEnd:
      typeof source.background_end === "string" &&
      /^#[\da-f]{6}$/i.test(source.background_end)
        ? source.background_end
        : "#ffffff",
    backgroundImage: websiteMediaUrl(source.background_image) ?? undefined,
    categoryAlignment: choice(
      "category_alignment",
      ["start", "center", "end"],
      "start",
    ),
    categoryCaps: bool("category_caps", false),
    categoryBackground: bool("category_background", false),
    itemAspectRatio: choice(
      "item_aspect_ratio",
      ["1/1", "3/2", "2/3", "4/3", "3/4", "16/9", "9/16"],
      "4/3",
    ),
    itemImageFit: choice("item_image_fit", ["cover", "contain"], "cover"),
    itemLayout: choice("item_layout", ["standard", "cover"], "standard"),
    itemWidth: choice("item_width", ["compact", "standard", "wide"], "standard"),
    itemRadius: choice("item_radius", ["square", "soft", "rounded"], "soft"),
    itemColorStyle: choice("item_color_style", ["default", "style-1", "style-2", "style-3", "style-4", "style-5", "style-6"], "default"),
    showCategories: bool("show_categories"),
    showSearch: bool("show_search"),
    showCategoryTitles: bool("show_category_titles"),
    showImages: bool("show_images"),
    showItemTitles: bool("show_item_titles"),
    showPrices: bool("show_prices"),
    priceDisplay: choice("price_display", ["range", "starting"], "range"),
    showBadges: bool("show_badges"),
    showDescriptions: bool("show_descriptions", false),
    showPortions: bool("show_portions"),
    imageRatio: choice(
      "image_ratio",
      ["square", "landscape", "wide", "portrait"],
      "square",
    ),
    imageFit: choice("image_fit", ["cover", "contain"], "cover"),
    imagePosition: choice("image_position", ["auto", "left", "right"], "auto"),
    imageSize: choice("image_size", ["default", "small", "medium", "large"], "default"),
    itemSpacing: optionalPixels("item_spacing", 80),
    rowPadding: optionalPixels("row_padding", 48),
    descriptionLines: choice("description_lines", ["default", "1", "2", "3", "all"], "default"),
    pricePlacement: choice("price_placement", ["after_description", "bottom"], source.card_style === "filled" ? "bottom" : "after_description"),
    cardBorder: choice("card_border", ["none", "line", "separator"], "none"),
    cardRadius: choice("card_radius", ["square", "soft", "rounded"], "square"),
    cardStyle: choice("card_style", ["plain", "filled"], "plain"),
    cardBackground: color("card_background"),
    cardTitleColor: color("card_title_color"),
    cardDescriptionColor: color("card_description_color"),
    cardPriceColor: color("card_price_color"),
    cardBorderColor: color("card_border_color"),
    imageRadius: choice(
      "image_radius",
      ["square", "soft", "rounded"],
      "square",
    ),
    itemAction: choice("item_action", ["none", "cutout"], "none"),
    showBanner: bool("show_banner"),
    bannerHeight: choice(
      "banner_height",
      ["small", "medium", "large"],
      "medium",
    ),
    showTitle: bool("show_title", false),
    showFulfillment: bool("show_fulfillment"),
    promptOnEntry: bool("prompt_on_entry"),
    itemImageFrames: Object.fromEntries(Object.entries(source.item_image_frames && typeof source.item_image_frames === "object" && !Array.isArray(source.item_image_frames) ? source.item_image_frames : {}).flatMap(([id, value]) => { const framing = normalizeImageFraming(value); return /^\d+$/.test(id) && framing ? [[id, framing]] : []; })) as Record<string, NonNullable<ReturnType<typeof normalizeImageFraming>>>,
    modalCover: bool("modal_cover"),
    modalCoverUrl: websiteMediaUrl(source.modal_cover_url) || undefined,
    modalCoverFraming: normalizeImageFraming(source.modal_cover_framing),
    backgroundImageFraming: normalizeImageFraming(source.background_image_framing),
    modalLogo: bool("modal_logo"),
    fulfillmentColorStyle: choice("fulfillment_color_style", ["default", "style-1", "style-2", "style-3", "style-4", "style-5", "style-6"], "default"),
  };
}

/** Projects public menu groups only; ungrouped catalogue items and tour entries never leak into this menu. */
export function websiteOrderMenus(
  menus: MenuData[],
  query = "",
  availableOnly = false,
) {
  const needle = query.trim().toLocaleLowerCase();
  return menus
    .filter((menu) => !menu.tour)
    .map((menu) => ({
      ...menu,
      groups: menu.groups
        .map((group) => ({
          ...group,
          items: menu.items.filter(
            (item) =>
              String(item.groupId) === String(group.id) &&
              !item.comboOnly &&
              item.availabilityState !== "hidden" &&
              (!availableOnly ||
                (item.available !== false &&
                  item.availabilityState !== "sold_out")) &&
              (!needle ||
                `${item.name} ${item.description ?? ""} ${Object.values(
                  item.translations ?? {},
                )
                  .map((v) => JSON.stringify(v))
                  .join(" ")}`
                  .toLocaleLowerCase()
                  .includes(needle)),
          ),
        }))
        .filter((group) => group.items.length > 0),
    }))
    .filter((menu) => menu.groups.length > 0);
}

/** Keeps the same availability gate as the existing order item cards. */
export function websiteItemAvailable(item: MenuItem) {
  return (
    item.available !== false &&
    item.availabilityState !== "sold_out" &&
    item.availabilityState !== "hidden" &&
    !item.comboOnly
  );
}

const copy = {
  en: {
    quantity: "Quantity",
    decrease: "Decrease quantity",
    increase: "Increase quantity",
    notAvailable: "Not available",
    categories: "Categories",
    all: "All items",
    availabilityFilter: "Availability filter",
    available: "Available items",
    search: "Search",
    pickup: "Pickup",
    delivery: "Delivery",
    pickupTitle: "Pickup at the restaurant",
    pickupWhen: "Pickup time",
    noPickupTimes: "No pickup times are currently available.",
    loadingTimes: "Loading pickup times…",
    address: "Enter delivery address",
    addressField: "Delivery address",
    view: "View menu",
    confirmPickup: "Confirm pickup",
    confirmDelivery: "Confirm address",
    update: "Update changes",
    change: "Change",
    info: "Store info",
    close: "Close",
    outside: "This address is outside our delivery area.",
    unresolved:
      "Enter a complete address so we can check delivery availability.",
    failure: "Unable to check this address. Please try again.",
    checking: "Checking…",
    pickupAt: "Pickup from",
    deliveryTo: "Deliver to",
    noResults: "No items found",
    changeBranch: "Choose another location",
    schedule: "Schedule order",
    scheduleError: "Unable to load available times.",
    retry: "Try again",
    noMinimum: "No minimum",
    asap: "As soon as possible",
    noTimes: "There are no times available for the selected date.",
  },
  fr: {
    quantity: "Quantité",
    decrease: "Diminuer la quantité",
    increase: "Augmenter la quantité",
    notAvailable: "Indisponible",
    categories: "Catégories",
    all: "Tous les articles",
    availabilityFilter: "Filtre de disponibilité",
    available: "Articles disponibles",
    search: "Rechercher",
    pickup: "Retrait",
    delivery: "Livraison",
    pickupTitle: "Retrait sur place",
    pickupWhen: "Retrait prévu",
    noPickupTimes: "Aucun créneau de retrait n’est disponible pour le moment.",
    loadingTimes: "Chargement des créneaux de retrait…",
    address: "Saisir l’adresse de livraison",
    addressField: "Adresse de livraison",
    view: "Voir le menu",
    confirmPickup: "Confirmer le retrait",
    confirmDelivery: "Confirmer l’adresse",
    update: "Enregistrer les modifications",
    change: "Modifier",
    info: "Infos sur l’établissement",
    close: "Fermer",
    outside: "Cette adresse se trouve hors de notre zone de livraison.",
    unresolved: "Saisissez une adresse complète pour vérifier la livraison.",
    failure: "Impossible de vérifier cette adresse. Réessayez.",
    checking: "Vérification…",
    pickupAt: "Retrait à",
    deliveryTo: "Livraison à",
    noResults: "Aucun article trouvé",
    changeBranch: "Choisir un autre établissement",
    schedule: "Programmer la commande",
    scheduleError: "Impossible de charger les créneaux.",
    retry: "Réessayer",
    noMinimum: "Aucun minimum",
    asap: "Dès que possible",
    noTimes: "Aucun créneau disponible pour la date sélectionnée.",
  },
  he: {
    quantity: "כמות",
    decrease: "הפחתת הכמות",
    increase: "הגדלת הכמות",
    notAvailable: "לא זמין",
    categories: "קטגוריות",
    all: "כל הפריטים",
    availabilityFilter: "סינון לפי זמינות",
    available: "פריטים זמינים",
    search: "חיפוש",
    pickup: "איסוף",
    delivery: "משלוח",
    pickupTitle: "איסוף עצמי מהמסעדה",
    pickupWhen: "מועד האיסוף",
    noPickupTimes: "אין כרגע מועדי איסוף זמינים.",
    loadingTimes: "טוען מועדי איסוף…",
    address: "הזינו כתובת למשלוח",
    addressField: "כתובת למשלוח",
    view: "הצגת תפריט",
    confirmPickup: "אישור האיסוף",
    confirmDelivery: "אישור הכתובת",
    update: "עדכון השינויים",
    change: "שינוי",
    info: "פרטי הסניף",
    close: "סגירה",
    outside: "הכתובת מחוץ לאזור המשלוחים.",
    unresolved: "הזינו כתובת מלאה לבדיקת המשלוח.",
    failure: "לא ניתן לבדוק את הכתובת. נסו שוב.",
    checking: "בודקים…",
    pickupAt: "איסוף מ־",
    deliveryTo: "משלוח ל־",
    noResults: "לא נמצאו פריטים",
    changeBranch: "בחירת סניף אחר",
    schedule: "תזמון הזמנה",
    scheduleError: "לא ניתן לטעון את השעות הזמינות.",
    retry: "נסו שוב",
    noMinimum: "ללא מינימום",
    asap: "בהקדם האפשרי",
    noTimes: "אין שעות זמינות לתאריך שנבחר.",
  },
};

/** Resolves public ordering copy through the existing website locale. */
export function websiteOrderCopy(locale: string) {
  return copy[locale as keyof typeof copy] ?? copy.en;
}
