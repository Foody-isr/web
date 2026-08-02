/** One image placed on a "color-title" category banner. Position is the sticker
 *  CENTER as a percent of the banner box; width is a percent of the banner width. */
export type BannerSticker = {
  id: string;
  imageUrl: string;
  xPct: number;
  yPct: number;
  widthPct: number;
  rotationDeg: number;
};

/** Title styling for a "color-title" banner. Empty fields inherit: text → the
 *  category name, font → the categoryTitle role, color → the theme ink. */
export type BannerTitleDesign = {
  text?: string;
  font?: string;
  size?: number; // multiplier, 1 = unchanged
  color?: string;
  align?: "left" | "center" | "right";
};

/** Per-category "color + title" banner design (used when the restaurant's
 *  category banner style is "color-title"). */
export type BannerDesign = {
  bgColor?: string;
  title?: BannerTitleDesign;
  stickers?: BannerSticker[];
};

/** A menu group (display container for items within a menu). */
export type MenuGroup = {
  id: string;
  name: string;
  description?: string;
  slug?: string;
  imageUrl?: string;
  /** Banner image focal point (0-100, percent from left/top) used as CSS
   *  object-position when the banner is cropped to fill. Default 50/50. */
  focalX?: number;
  focalY?: number;
  /** Per-category "color + title" banner design. */
  bannerDesign?: BannerDesign | null;
  translations?: import("./translations").TranslationMap | null;
};

/** @deprecated Use MenuGroup instead. */
export type MenuCategory = MenuGroup;

export type ItemType = 'food_and_beverage' | 'combo';

export type MenuItem = {
  id: string;
  name: string;
  description?: string;
  /** Serving-size label shown under the title. Used when the item has no size
   *  options; items with sizes derive a range from their option portions. */
  portion?: string;
  price: number;
  /** Pricing model. 'standard' (default) uses `price`; 'by_weight' derives a
   *  display-only estimate from `pricePerKg` and `estimatedWeightGrams`. The
   *  server stays authoritative — it recomputes the weight estimate at order
   *  creation, so any client price for a by-weight item is display-only. */
  pricingMode?: 'standard' | 'by_weight';
  /** Price per kilogram (by-weight items only). */
  pricePerKg?: number;
  /** Estimated weight in grams used to compute the display estimate. */
  estimatedWeightGrams?: number;
  imageUrl?: string;
  /** The menu group this item belongs to (for display grouping). */
  groupId: string;
  tags?: string[];
  available?: boolean;
  /** Recipe-aware availability computed server-side. 'hidden' items are already
   *  omitted from the public response, so only available/low/sold_out arrive. */
  availabilityState?: 'available' | 'low' | 'sold_out' | 'hidden';
  /** Portions still buildable, when the assigned rule chooses to show it. */
  buildableCount?: number | null;
  /** Immediate-sale channel ("Disponible maintenant"). '' = pre-order only;
   *  'surplus' = pre-orderable in the lot, then same-day sellable after the
   *  cutoff; 'standalone' = same-day only, never in the pre-order lot. */
  immediateSaleMode?: '' | 'surplus' | 'standalone';
  /** Product-level scheduling override; null inherits the restaurant promise. */
  preparationLeadTimeMinutes?: number | null;
  /** Counted finished stock can satisfy an immediate order while it lasts. */
  comboOnly?: boolean;
  /** Item type: 'food_and_beverage' (default) or 'combo'. */
  itemType?: ItemType;
  /** Combo steps (only present when itemType === 'combo'). */
  comboSteps?: ComboStep[];
  /** Per-item toggle for the "special instructions" field. undefined/null =
   *  default (shown); false = hidden; true = shown. */
  allowNotes?: boolean | null;
  /** Combo only: allow the guest quantity-first flow. Absent = allowed. */
  comboAllowQuantity?: boolean;
  modifiers?: MenuItemModifier[];
  /** Square-compatible modifier sets. Use these when present. */
  modifierSets?: ModifierSet[];
  /** Reusable option sets (e.g. "Sizes" shared across items). First option is default. */
  optionSets?: OptionSetType[];
  translations?: import("./translations").TranslationMap | null;
};

/** A reusable option set attached to a menu item. */
export type OptionSetType = {
  id: number;
  name: string;
  sortOrder: number;
  options: OptionSetOptionType[];
  translations?: import("./translations").TranslationMap | null;
};

/** A single option within an option set. Price is absolute. */
export type OptionSetOptionType = {
  id: number;
  name: string;
  price: number;
  onlinePrice?: number | null;
  /** Serving-size label for this option (e.g. "250g"), shown next to it. */
  portion?: string;
  isActive: boolean;
  sortOrder: number;
  /** When true, the variant is hidden from à la carte display. Combo steps
   *  that explicitly reference it still expose it. Used for variants that
   *  exist purely for combo recipe scaling. */
  isComboOnly?: boolean;
  translations?: import("./translations").TranslationMap | null;
};

export type MenuItemModifier = {
  id: string;
  name: string;
  action: "add" | "remove";
  /** Conversational verb chosen at order time (Square-style). Set on cart-line
   *  modifiers; overrides `action` for display and pricing. */
  operator?: import("./modifierOperator").ModifierOperatorValue;
  category?: string;
  priceDelta: number;
  isActive?: boolean;
  /** 0 = unlimited (multi-select), 1 = single-choice, N = up to N */
  maxSelection?: number;
  /** true = at least one selection in this category is required before adding to cart */
  isRequired?: boolean;
  /** Number of free selections before extra charge applies (0 = normal pricing) */
  freeQuantity?: number;
  /** Price per selection beyond freeQuantity (0 = use priceDelta) */
  extraPrice?: number;
  /** Auto-select when item detail modal opens */
  isPreselected?: boolean;
  /** Hidden from guest ordering (strip client-side as a defensive measure) */
  hideOnline?: boolean;
  translations?: import("./translations").TranslationMap | null;
};

/** A reusable modifier set (Square-compatible). */
export type ModifierSet = {
  id: string;
  name: string;
  /** Display name shown to guests. Falls back to name if empty. */
  displayName: string;
  isRequired: boolean;
  allowMultiple: boolean;
  minSelections: number;
  maxSelections: number;
  hideOnReceipt: boolean;
  useConversational: boolean;
  /** Limits which verbs the palette shows. Empty/absent = all verbs. */
  enabledVerbs?: string[];
  sortOrder: number;
  modifiers: ModifierSetModifier[];
  translations?: import("./translations").TranslationMap | null;
};

/** A modifier belonging to a modifier set. */
export type ModifierSetModifier = {
  id: string;
  name: string;
  action: "add" | "remove";
  priceDelta: number;
  isActive?: boolean;
  isPreselected?: boolean;
  /** Clients must strip this client-side (server also strips from public API). */
  hideOnline?: boolean;
  sortOrder?: number;
  translations?: import("./translations").TranslationMap | null;
};

// ============ Combo / Set Menu Types ============

export type ComboMenu = {
  id: number;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  isActive: boolean;
  sortOrder: number;
  steps: ComboStep[];
  /** Allow ordering several at once. Absent/true = allowed; false = single only. */
  allowQuantity?: boolean;
};

export type ComboStep = {
  id: number;
  name: string;
  description?: string;
  minPicks: number;
  maxPicks: number;
  sortOrder: number;
  items: ComboStepItem[];
  /** Per-size pick caps for a group-sourced step. When present the customer
   *  chooses a size per pick within these limits (e.g. up to 4 at 500g, the
   *  rest 250g). The set of labels also defines which sizes are selectable. */
  variantRules?: ComboStepVariantRule[];
  /** Default cap on how many times any single item may be picked in this step
   *  (counted across sizes). 0/undefined = unlimited. */
  maxPerItem?: number;
  /** Per-item overrides of maxPerItem for specific items. */
  itemLimits?: ComboStepItemLimit[];
};

export type ComboStepVariantRule = {
  /** Variant/option name this rule caps (e.g. "500g"). */
  variantLabel: string;
  /** Minimum picks that must use this size. 0 = no minimum. */
  minPicks: number;
  /** Maximum picks that may use this size. 0 = unlimited. */
  maxPicks: number;
};

export type ComboStepItemLimit = {
  /** Menu item this cap applies to. */
  menuItemId: number;
  /** Max times this item may be picked in the step (across sizes). 0 = unlimited. */
  maxQty: number;
};

export type ComboStepItem = {
  id: number;
  menuItemId: number;
  optionId?: number | null;
  priceDelta: number;
  menuItem: {
    id: number;
    name: string;
    description?: string;
    price: number;
    imageUrl?: string;
    availabilityState?: 'available' | 'low' | 'sold_out' | 'hidden';
    buildableCount?: number | null;
  };
};

/**
 * A delivery tour: a one-off round to a city outside the restaurant's usual
 * delivery zones, on a given day, served with its own carte.
 *
 * Present on a MenuData only while the tour's ordering window is open. Once the
 * cutoff passes the server simply stops returning the entry, so the tab
 * disappears on its own; the client never has to expire a tour itself.
 */
export type TourInfo = {
  id: number;
  name: string;
  /** URL slug used in the tour's dedicated link (/r/<rid>/tournee/<slug>).
   *  Only the dedicated-link endpoint returns it; absent elsewhere. */
  slug?: string;
  /** "YYYY-MM-DD" — the day this round is delivered. */
  deliveryDate: string;
  /** ISO timestamp. Orders for this tour close at this instant. */
  cutoffAt: string;
  /** The only cities this tour delivers to. */
  cities: string[];
  deliveryFee: number;
  /** null = fall back to the restaurant's global minimum. */
  minOrder: number | null;
  /** "HH:MM" */
  deliveryStart?: string;
  /** "HH:MM" */
  deliveryEnd?: string;
  requirePrepayment: boolean;
};

export type MenuData = {
  /**
   * Stable, unique identity of THIS entry within `MenuResponse.menus`.
   *
   * `id` is NOT unique in that list. The server returns one entry per open
   * tour, and two tours routinely share the same carte — the nominal case is a
   * restaurant keeping a single "tournée" carte and running every round off it
   * (Raanana Tuesday, Jérusalem Thursday). The same menu id then appears twice,
   * with different `tour` objects. A carte that is also web-enabled surfaces
   * both as a plain carte and once per tour.
   *
   * A guest tab is therefore a TOUR, not a carte. Key tabs, React lists and
   * "active carte" state on `entryKey`, never on `id` alone — otherwise the
   * Jérusalem tab overwrites the Raanana one and that round cannot be ordered.
   *
   * Shape: `tour-<tourId>` for a tour entry, `menu-<menuId>` for a plain carte.
   */
  entryKey: string;
  id: number;
  name: string;
  /** Menu groups — the display containers for items (e.g. "Salads", "Drinks"). Primary source. */
  groups: MenuCategory[];
  /** @deprecated Use groups instead. Kept for backward compat — always mirrors groups. */
  categories: MenuCategory[];
  items: MenuItem[];
  /** Set when this entry is served by an open delivery tour. */
  tour?: TourInfo;
};

export type MenuResponse = {
  restaurantId: string;
  restaurantName?: string;
  currency: string;
  /** All active menus for the restaurant (filtered by channel + availability hours). */
  menus: MenuData[];
  /** @deprecated Flat list of all items across all menus — kept for backward compat */
  categories: MenuCategory[];
  items: MenuItem[];
};

export type CartLine = {
  id: string;
  item: MenuItem;
  quantity: number;
  note?: string;
  modifiers?: MenuItemModifier[];
  /** Selected variant (first variant used as default if not explicitly set). */
  selectedVariantId?: number;
  selectedVariantName?: string;
  selectedVariantPrice?: number;
  // Combo fields (set when this line represents a combo)
  comboId?: number;
  comboName?: string;
  comboSelections?: ComboCartSelection[];
  /** For an N-batch ("Combo ×N"): the N per-combo selection arrays the order
   *  is split into. Length N. Absent for single (×1) combos. */
  comboOrderBatch?: ComboCartSelection[][];
};

export type ComboCartSelection = {
  stepId: number;
  stepName: string;
  menuItemId: number;
  menuItemName: string;
  optionId?: number | null;
  optionName?: string;
  quantity: number;
  priceDelta: number;
  notes?: string;
};

export type OrderPayload = {
  restaurantId: string;
  tableId?: string;
  sessionId?: string;
  guestId?: string;
  guestName?: string;
  orderType: OrderType;
  // For delivery orders
  customerName?: string;
  customerPhone?: string;
  // Optional opt-in confirmation email (prefilled from Google sign-in when present)
  customerEmail?: string;
  // Language the customer is browsing in (he/fr/en). Stored on the order so staff
  // can message the customer back in their own language.
  customerLocale?: string;
  deliveryAddress?: string;
  deliveryCity?: string;
  deliveryFloor?: string;
  deliveryApt?: string;
  deliveryEntryCode?: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  deliveryNotes?: string;
  // Answers to checkout-builder custom fields, keyed by field id.
  customFields?: Record<string, string | number | boolean>;
  items: Array<{
    itemId: string;
    quantity: number;
    note?: string;
    selectedVariantId?: number;
    modifiers?: Array<{
      modifierId: string;
      applied: boolean;
      operator?: string;
    }>;
  }>;
  paymentMethod: "pay_now" | "pay_later" | "cash" | "cibus";
  paymentRequired?: boolean;
  splitByItemIds?: string[];
  // Combo items
  combos?: Array<{
    comboItemId?: number;
    selections: Array<{
      stepId: number;
      menuItemId: number;
      optionId?: number | null;
      quantity: number;
      notes?: string;
    }>;
    notes?: string;
  }>;
  // Scheduled pickup
  isScheduled?: boolean;
  scheduledFor?: string;              // "YYYY-MM-DD"
  scheduledPickupWindowStart?: string; // "HH:MM"
  scheduledPickupWindowEnd?: string;   // "HH:MM"
  /**
   * Set when the cart was built from a delivery tour's carte. The server
   * resolves the delivery date, the window, the fee and the minimum from the
   * tour itself, and validates the address against that tour's zone alone.
   *
   * Rejections come back as 422 with one of: `tour_not_found`, `tour_closed`,
   * `tour_address_outside_zone`, `tour_address_unresolved`, `tour_item_mismatch`.
   */
  tourId?: number;
};

/**
 * Delivery / courier info surfaced on the confirmation page.
 *
 * Populated by the server into `external_metadata.delivery` on the public
 * order response (snake_case keys). The card only renders the fields that are
 * present, so the page degrades gracefully before the backend ships these.
 */
export type OrderDeliveryInfo = {
  courierName?: string;
  courierPhone?: string;
  etaStart?: string; // ISO8601 timestamp or "HH:MM"
  etaEnd?: string; // ISO8601 timestamp or "HH:MM"
  note?: string; // free-text note from the restaurant owner
};

export type OrderResponse = {
  orderId: string;
  total: number;
  currency: string;
  orderSource?: OrderSource;
  orderType?: OrderType;
  externalMetadata?: Record<string, any> | null;
  delivery?: OrderDeliveryInfo | null;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  receiptToken?: string;
  paymentUrl?: string;
  tableCode?: string;
  sessionId?: string;
  serviceMode?: string;
};

export type OrderStatus =
  | "scheduled"
  | "pending_review"
  | "accepted"
  | "rejected"
  | "in_kitchen"
  | "ready"
  | "ready_for_delivery"
  | "out_for_delivery"
  | "served"
  | "received" // NEW: Unified dine-in completion status
  | "delivered"
  | "cancelled"
  | "refunded";

export type PaymentStatus = "unpaid" | "pending" | "paid" | "refunded";

export type OrderSource =
  | "qr_dine_in"
  | "wolt"
  | "manual"
  | "website_order"
  | "unknown_external";

export type OrderType = "dine_in" | "delivery" | "pickup";

// ============ Table Session Types ============

export type SessionGuest = {
  id: string;
  session_id: string;
  display_name: string;
  avatar_emoji: string;
  created_at: string;
};

export type TableSession = {
  id: string;
  restaurant_id: number;
  table_code: string;
  /** Human-readable label for the table (e.g. "Interieur 6"). Server resolves this from the RestaurantTable row; absent if no row matches. */
  table_name?: string;
  status: "active" | "expired";
  expires_at: string;
  guests: SessionGuest[];
};

export type TableOrder = {
  id: number;
  restaurant_id: number;
  table_code: string;
  session_id: string;
  guest_id?: string;
  guest_name?: string;
  customer_name?: string;
  order_status: OrderStatus;
  status: OrderStatus;
  payment_status: PaymentStatus;
  total_amount: number;
  created_at: string;
  items: TableOrderItem[];
};

export type TableOrderItem = {
  id: number;
  menu_item_id: number;
  quantity: number;
  price: number;
  notes?: string;
  modifiers?: Array<{
    name: string;
    action: string;
    price_delta: number;
  }>;
};

// ============ Opening Hours ============

export interface DaySchedule {
  closed: boolean;
  open: string;  // "HH:MM" format (24-hour)
  close: string; // "HH:MM" format (24-hour)
}

export interface ServiceTypeSchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface OpeningHoursConfig {
  dine_in: ServiceTypeSchedule;
  pickup: ServiceTypeSchedule;
  delivery: ServiceTypeSchedule;
}

// ============ Restaurant ============

export type Restaurant = {
  id: number;
  name: string;
  slug?: string;
  address?: string;
  timezone?: string;
  logoUrl?: string;
  coverUrl?: string;
  coverDisplayMode?: "cover" | "contain" | "repeat"; // How the cover image is rendered
  coverFocalX?: number; // 0-100, percent from left. Defaults to 50 (center) when absent.
  coverFocalY?: number; // 0-100, percent from top.  Defaults to 50 (center) when absent.
  backgroundColor?: string; // Hex color (e.g. "#FF5733") for solid background
  description?: string;
  /** Language the owner authors the menu in ("en" | "he" | "fr"). Drives the
   *  Wolt-style "this menu is in X, translate?" prompt; absent on older API. */
  defaultLocale?: string;
  phone?: string;
  openingHours?: string; // Legacy text format
  openingHoursConfig?: OpeningHoursConfig; // Structured opening hours
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  dineInEnabled: boolean;
  cateringEnabled?: boolean; // Restaurant has the catering feature on (drives catering nav)
  cateringOnly?: boolean; // No classic menu: land on /catering, hide Menu, guard /order
  /** Public-safe API decision for exposing the Stories destination. */
  storiesNavigationAvailable?: boolean;
  requireDineInPrepayment?: boolean; // If true, dine-in guests must pay before order is sent
  aiAssistantEnabled?: boolean; // If true, show the guest AI ordering assistant
  aiAssistantTrigger?: "manual" | "immediate" | "delay"; // how the assistant proactively appears
  aiAssistantTriggerDelay?: number; // seconds before the delayed proactive prompt
  serviceMode?: "counter" | "table"; // counter = day mode (customer picks up), table = night mode (waiter delivers)
  rushMode?: boolean; // When true, restaurant is temporarily paused
  ordersPaused?: boolean; // Effective one-click pause (expiry already applied server-side)
  tipsEnabled?: boolean; // When false, skip the tip step for customers
  // OTP mode for guest checkout (pickup/delivery):
  //   "required" — phone + code (default, current behaviour)
  //   "skip"     — no code at all, phone optional (notifications only)
  otpMode?: "required" | "skip";
  schedulingEnabled?: boolean;
  schedulingMinDaysAhead?: number;
  schedulingLeadTimeMinutes?: number;
  schedulingMaxDaysAhead?: number;
  schedulingRequirePrepayment?: boolean;
  schedulingSlotDurationMinutes?: number;
  batchFulfillmentEnabled?: boolean;
  minimumOrderDelivery?: number;
  websiteConfig?: WebsiteConfig;
  websiteSections?: WebsiteSection[];
  // Platform-supplied Google Places API key. Powers the checkout address
  // autocomplete when the restaurant enables it via WebsiteConfig.checkoutConfig.
  // Empty string when the platform hasn't configured Places.
  googlePlacesApiKey?: string;
};

// ============ Website Config ============

/** A website page exposed to the shared site navigation. */
export type WebsitePage = {
  slug: string;
  label: string;
  sortOrder: number;
  pageType?: "landing" | "content" | "order" | "catering";
  /** Explicit Website V3 homepage identity. Absent for legacy payloads. */
  isHomepage?: boolean;
  /** Default commerce pages use the canonical /order or /catering alias. */
  isDefault?: boolean;
  /** Show this page in the horizontal top nav. Defaults to true when omitted. */
  showInNav?: boolean;
  /** Treat this custom page as a "shopping" page (drops the full top nav, uses
   *  the shopping navigation). Defaults to false (content page). */
  isShopping?: boolean;
};

/** A single navbar composition mode for one device.
 *  full = logo + inline links + CTA; compact = floating hamburger + CTA;
 *  hidden = no top bar. */
export type NavMode = 'full' | 'compact' | 'hidden';
/** Navigation composition for one page-type, split by device, plus the
 *  mobile-only bottom-bar toggle. */
export type NavLayoutSide = { desktop: NavMode; mobile: NavMode; bottom_bar: boolean };
/** Per-page-type navigation composition. `content` = landing + content pages;
 *  `shopping` = order, catering, and custom pages flagged shopping. */
export type NavigationIcon = 'home' | 'menu' | 'grid' | 'play' | 'bag' | 'user' | 'page';
export type BottomNavigationStyle = {
  order?: string[];
  icons?: Record<string, NavigationIcon>;
  background_color?: string;
  button_background_color?: string;
  text_color?: string;
  active_text_color?: string;
};
export type CompactNavigationStyle = {
  hamburger_position?: 'left' | 'right';
  actions_position?: 'left' | 'right';
  icon_color?: string;
  button_background_color?: string;
};
export type NavLayout = {
  content: NavLayoutSide;
  shopping: NavLayoutSide;
  bottom_navigation?: BottomNavigationStyle;
  compact_navigation?: CompactNavigationStyle;
};

/** Optional per-section color overrides (hex strings). Any omitted section or
 *  field falls back to the global theme token for that color. */
export type SectionColors = {
  navbar?: { bg?: string; text?: string };
  hero?: { bg?: string; text?: string };
  metadata?: { bg?: string; text?: string };
  categoryBar?: { bg?: string; text?: string; accent?: string; divider?: string };
  categoryBarSticky?: { bg?: string; text?: string; accent?: string; divider?: string };
  /** Catering shop: bg, button/accent, and button-label text (falls back to brand). */
  catering?: { bg?: string; text?: string; accent?: string };
};

export type NavbarCtaSurfaceStyle = {
  variant?: 'filled' | 'outline' | 'ghost';
  bg?: string;
  text_color?: string;
  border_color?: string;
};

export type NavbarCtaConfig = NavbarCtaSurfaceStyle & {
  enabled?: boolean;
  text?: string;
  link?: string;
  shape?: 'pill' | 'rounded' | 'square';
  size?: 'sm' | 'md' | 'lg';
  transparent?: NavbarCtaSurfaceStyle;
  solid?: NavbarCtaSurfaceStyle;
};

export type OrderTypeSelectorConfig = NavbarCtaSurfaceStyle & {
  shape?: 'pill' | 'rounded' | 'square';
  size?: 'sm' | 'md' | 'lg';
};

export type WebsiteConfig = {
  // Theme system (menu/order page)
  themeId: string;
  pairingId: string;
  brandColor: string | null;
  layoutDefault: 'compact' | 'magazine';
  /** Initial menu layout on phones. Empty/null/absent = follow layoutDefault. */
  layoutDefaultMobile?: 'compact' | 'magazine' | '' | null;

  // Landing-page concerns (kept; landing page uses these)
  heroLayout: 'standard' | 'minimal' | 'fullscreen';
  welcomeText?: string;
  tagline?: string;
  socialLinks?: Record<string, string>;
  showAddress: boolean;
  showPhone: boolean;
  showHours: boolean;
  faviconURL?: string;
  heroCtaText?: string;
  midCtaEnabled?: boolean;
  midCtaTitle?: string;
  midCtaBody?: string;
  midCtaBtnText?: string;
  footerText?: string;
  navbarStyle?: 'solid' | 'transparent' | 'overlay' | 'custom' | 'hidden';
  navbarColor?: string;
  logoSize?: number;
  hideNavbarName?: boolean;
  /** Landing navbar: logo placement, a second (solid-state) logo, per-state text
   *  colors, and the action button. `overlay` style is transparent over the hero
   *  and solid on hover. */
  navbarLogoPosition?: 'left' | 'center' | 'right';
  navbarScrolledLogoUrl?: string;
  navbarTextColor?: string;
  navbarOverlayTextColor?: string;
  /** Button content plus distinct transparent and solid surface treatments. */
  navbarCta?: NavbarCtaConfig | null;
  /** Navbar composition: inline page links on/off, and the hamburger drawer
   *  button ('mobile' = phones only, 'always', or 'off'). */
  navbarShowLinks?: boolean;
  navbarHamburger?: 'mobile' | 'always' | 'off';
  /** Navbar typography: a navbar-specific font family (applied to inline links +
   *  restaurant name) plus weight/size/letter-spacing/uppercase. */
  navbarFont?: string;
  navbarType?: { weight?: number; size?: number; letter_spacing?: number; uppercase?: boolean } | null;
  /** Inline nav-link visual treatment. */
  navbarLinkStyle?: 'text' | 'underline' | 'pill' | 'bordered';
  /** Per-(page-type × device) navigation composition (Phase B). NULL ⇒ derived
   *  from the legacy navbar_* fields. */
  navLayout?: NavLayout | null;
  /** Hides the restaurant logo image overlaid on the hero cover (mobile, above the name). */
  hideHeroLogo?: boolean;
  /** Background of the rounded-square logo box on the order-page hero. Default 'white'. */
  heroLogoBg?: 'white' | 'black';
  /**
   * Order-page cover composition. 'card' (default) shows the rounded logo box
   * with the restaurant name and tagline; 'logo' renders the logo on its own,
   * centered directly on the cover, with no name, tagline or box; 'bare'
   * keeps the logo at the card position (straddling the cover's bottom edge)
   * but drops the box, name and tagline.
   */
  heroCoverLayout?: 'card' | 'logo' | 'bare';
  /** Scales the cover logo, as a percentage of its default size (100 = default). */
  heroLogoSize?: number;
  /**
   * User-defined palette. When themeId === "custom" the theme resolver builds
   * a synthetic theme from these 4 swatches; otherwise this is stored but inactive.
   */
  customPalette?: {
    mode: 'light' | 'dark';
    bg: string;
    surface: string;
    accent: string;
    ink: string;
    /** Text color for category banners/dividers. Optional — falls back to `ink`
     *  so existing palettes render identically until an owner sets it. */
    categoryInk?: string;
    /** Background fill of the search field. Optional — falls back to the muted
     *  surface so existing palettes are unchanged until an owner sets it. */
    searchBg?: string;
    /** Text color for item/combo detail modals ("fiches"). Optional — falls back
     *  to `ink` so existing palettes are unchanged until an owner sets it. */
    menuText?: string;
  };
  /** Optional per-section color overrides layered on top of the active theme.
   *  Any missing section/field inherits the global theme color. */
  sectionColors?: SectionColors | null;
  /** Font family applied to the restaurant name overlay on the order/menu hero. */
  heroNameFont?: string;
  /** Per-restaurant override for the category section divider style on the order page. */
  categoryBannerStyle?: 'image-overlay' | 'image-only' | 'text-block' | 'striped-rule' | 'color-title' | 'none';
  /** Darkness (0-100) of the dark veil over image-overlay banners. Defaults to 40; 0 disables it. Shared across devices. */
  categoryBannerOverlay?: number;
  /** How image-overlay banners fill their box (desktop): "cover" (crop, default), "contain" (whole image + blurred fill), or "natural" (full-width at the image's own aspect ratio). */
  categoryBannerFit?: 'cover' | 'contain' | 'natural';
  /** Mobile override for the banner fit; empty/null inherits the desktop value. */
  categoryBannerFitMobile?: 'cover' | 'contain' | 'natural' | '' | null;
  /** Per-role typography overrides (overall size scale + per-role font/size) for the order/menu page. */
  typography?: import("./themes/typography").TypographyOverrides | null;
  /** Published V3 pages available to the shared site navigation. */
  pages?: WebsitePage[] | null;
  /** When false, /r/<slug> redirects to /r/<slug>/order instead of rendering the landing page. */
  landingEnabled?: boolean;
  /** Whether the customer Stories/Reels page + bottom-nav tab is enabled. */
  storiesEnabled?: boolean;
  /** Whether public navigation shows the guest order-history destination. */
  showOrdersLink?: boolean;
  /** Comma-separated order of the mobile bottom-nav page tabs ("menu","stories"). First is the default landing tab. Account is always last. Empty = default. */
  navOrder?: string;
  /** Optional checkout-form builder config. When absent/null the foodyweb checkout falls back to the legacy hard-coded flow. */
  checkoutConfig?: CheckoutConfig | null;
  /** Order-page info placement (metadata bar per mode + "Plus" modal sections). When absent foodyweb uses its default item set. */
  orderPageInfo?: OrderPageInfo | null;
  /** Appearance of the pickup/delivery selector on order pages. */
  orderTypeSelector?: OrderTypeSelectorConfig | null;
};

// ─── Order-page info placement ────────────────────────────────────────
// Drives which restaurant-info items appear in the order page's metadata bar
// (per order mode) vs the "Plus" modal. Configured in the website builder;
// mirrors the order_page_info jsonb on the server.

/** Items that can appear in the hero metadata bar. */
export type OrderPageBarItem =
  | "batch_week"        // "Pré-commande · Ouvre Mercredi 22:00" (batch only)
  | "hours"             // "Ouvert · 22:00"
  | "min_order"         // "Min ₪350" (pickup/delivery)
  | "fulfilment_time"   // "Prêt en 15 min" / "25–40 min"
  | "wifi"              // Free WiFi chip (dine-in)
  | "instagram"
  | "whatsapp"
  | "facebook"
  | "tiktok"
  | "more";             // the "Plus ›" button that opens the modal

/** Sections that can appear in the "Plus" modal. */
export type OrderPageModalSection =
  | "about" | "hours" | "address" | "contact" | "social" | "custom_text";

export type OrderPageInfo = {
  bar: {
    pickup: OrderPageBarItem[];
    delivery: OrderPageBarItem[];
    dine_in: OrderPageBarItem[];
  };
  modal: OrderPageModalSection[];
  /** Free text shown when `custom_text` is enabled in `modal`. */
  modalText?: string;
};

// ─── Checkout-form builder ────────────────────────────────────────────
// Mirrors foodyserver/internal/restaurants/checkout_config.go and the type
// shape in foodyadmin/src/lib/api.ts. The renderer uses these to drive
// what fields appear on the checkout page (delivery / pickup only).

export type CheckoutFieldKind = 'builtin' | 'custom';
export type CheckoutFieldType = 'text' | 'textarea' | 'tel' | 'email' | 'select' | 'checkbox';
export type CheckoutVisibilityOperator = 'equals' | 'not_empty' | 'one_of';

export type CheckoutVisibilityRule = {
  field: string;
  operator: CheckoutVisibilityOperator;
  value?: string | number | boolean;
  values?: string[];
};

export type CheckoutOption = {
  value: string;
  label?: Record<string, string>;
};

export type CheckoutFieldConfig = {
  id: string;
  kind: CheckoutFieldKind;
  type?: CheckoutFieldType;
  enabled: boolean;
  required: boolean;
  label?: Record<string, string>;
  placeholder?: Record<string, string>;
  options?: CheckoutOption[];
  visible_when?: CheckoutVisibilityRule | null;
};

export type CheckoutFormConfig = {
  require_auth: boolean;
  address_autocomplete?: boolean;
  fields: CheckoutFieldConfig[];
};

export type CheckoutConfig = {
  delivery?: CheckoutFormConfig | null;
  pickup?: CheckoutFormConfig | null;
  confirmation?: ConfirmationConfig | null;
  // When true, the order page's fulfilment chip is read-only and the customer
  // chooses pickup/delivery only at checkout. Mirrors the server JSON key.
  lock_order_type?: boolean;
};

// ─── Confirmation page builder ──────────────────────────────────────
// Drives the post-order tracking page when the owner has configured it.
// Null/undefined → foodyweb falls back to its hard-coded default UI.

export type ConfirmationAction = {
  id: string;
  kind: 'builtin' | 'custom';
  enabled: boolean;
  label?: Record<string, string>;
  config?: Record<string, unknown>;
};

export type ConfirmationFAQ = {
  question?: Record<string, string>;
  answer?: Record<string, string>;
};

/**
 * Per-service delivery disclosure flags surfaced on the confirmation page.
 * Mirrors `ConfirmationDelivery` in foodyserver (`internal/restaurants/
 * checkout_config.go`) — snake_case to match the JSON stored on the server.
 */
export type ConfirmationDeliveryConfig = {
  show_courier?: boolean;
  show_eta?: boolean;
  note?: string;
};

export type ConfirmationConfig = {
  title?: Record<string, string>;
  subtitle?: Record<string, string>;
  actions?: ConfirmationAction[];
  faq?: ConfirmationFAQ[];
  delivery?: ConfirmationDeliveryConfig | null;
};

// ============ Website Sections ============

export type WebsiteSection = {
  id: number;
  sectionType: string;
  page: string;
  sortOrder: number;
  isVisible: boolean;
  layout: string;
  content: Record<string, any>;
  settings: Record<string, any>;
  /** Per-locale text overrides, keyed field-path -> locale -> value
   *  (e.g. { "headline": { he: "…" }, "cards.0.title": { he: "…" } }).
   *  Auto-filled on publish; missing locales fall back to the source text. */
  translations?: Record<string, Record<string, string>>;
};

// ============ Courier Tracking ============

/** Live courier position returned by GET /api/v1/public/delivery/track.
 *  All coordinate and ETA fields are absent when the privacy gate is not met. */
export type CourierTracking = {
  courierFirstName?: string;
  courierLat: number;
  courierLng: number;
  destLat?: number;
  destLng?: number;
  etaSeconds?: number;
};

// ============ Scheduling ============

export type SchedulingTimeSlot = {
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
};

export type SchedulingConfigResponse = {
  enabled: boolean;
  slotDurationMinutes: number;
  requirePrepayment: boolean;
  slotsByDate: Record<string, SchedulingTimeSlot[]>; // "YYYY-MM-DD" → slots
  leadTimeMinutes: number;
  earliestFulfillmentAt?: string;
  immediateAvailable: boolean;
  constrainedBy?: FulfillmentConstraint;
};

export type FulfillmentConstraint = {
  menuItemId: number;
  name: string;
  leadTimeMinutes: number;
};

export type FulfillmentCartItem = { itemId: string | number; quantity: number };

// ============ Batch Fulfillment ============

export type BatchFulfillmentWindow = {
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
};

export type BatchFulfillmentDayInfo = {
  date: string;    // "YYYY-MM-DD"
  dayName: string; // e.g. "Friday"
  pickupWindow?: BatchFulfillmentWindow;
  deliveryWindow?: BatchFulfillmentWindow;
};

export type BatchCycleSummary = {
  openAt: string;   // ISO 8601 datetime
  cutoffAt: string; // ISO 8601 datetime
  fulfillmentDays: BatchFulfillmentDayInfo[];
};

export type BatchFulfillmentConfigResponse = {
  enabled: boolean;
  orderingOpen: boolean;
  // Current/upcoming cycle: when ordering opens (in active window or about to)
  // and when it closes. During the gap between cutoff and next open, this is
  // the upcoming cycle and openAt is in the future.
  currentBatchOpenAt: string; // ISO 8601 datetime
  currentBatchCutoff: string; // ISO 8601 datetime
  cutoffDayName: string;      // e.g. "Wednesday" — in restaurant timezone
  cutoffTime: string;         // "HH:MM" — in restaurant timezone
  openDayName: string;        // e.g. "Wednesday" — in restaurant timezone
  openTime: string;           // "HH:MM" — in restaurant timezone
  fulfillmentDays: BatchFulfillmentDayInfo[];
  // Next cycle (the one AFTER current). Empty strings when no further cycles
  // are configured.
  nextBatchOpenAt: string;
  nextBatchCutoff: string;
  nextFulfillmentDays: BatchFulfillmentDayInfo[];
  // Up to 6 cycles starting with current.
  upcomingCycles: BatchCycleSummary[];
  requirePrepayment: boolean;
  leadTimeMinutes: number;
  immediateAvailable: boolean;
  constrainedBy?: FulfillmentConstraint;
};
