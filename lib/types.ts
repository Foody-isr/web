/** A menu group (display container for items within a menu). */
export type MenuGroup = {
  id: string;
  name: string;
  description?: string;
  slug?: string;
  imageUrl?: string;
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
  comboOnly?: boolean;
  /** Item type: 'food_and_beverage' (default) or 'combo'. */
  itemType?: ItemType;
  /** Combo steps (only present when itemType === 'combo'). */
  comboSteps?: ComboStep[];
  /** Per-item toggle for the "special instructions" field. undefined/null =
   *  default (shown); false = hidden; true = shown. */
  allowNotes?: boolean | null;
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
};

export type ComboStep = {
  id: number;
  name: string;
  description?: string;
  minPicks: number;
  maxPicks: number;
  sortOrder: number;
  items: ComboStepItem[];
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
  };
};

export type MenuData = {
  id: number;
  name: string;
  /** Menu groups — the display containers for items (e.g. "Salads", "Drinks"). Primary source. */
  groups: MenuCategory[];
  /** @deprecated Use groups instead. Kept for backward compat — always mirrors groups. */
  categories: MenuCategory[];
  items: MenuItem[];
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
  deliveryAddress?: string;
  deliveryCity?: string;
  deliveryFloor?: string;
  deliveryApt?: string;
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
  paymentMethod: "pay_now" | "pay_later" | "cash";
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
  requireDineInPrepayment?: boolean; // If true, dine-in guests must pay before order is sent
  serviceMode?: "counter" | "table"; // counter = day mode (customer picks up), table = night mode (waiter delivers)
  rushMode?: boolean; // When true, restaurant is temporarily paused
  tipsEnabled?: boolean; // When false, skip the tip step for customers
  // OTP mode for guest checkout (pickup/delivery):
  //   "required" — phone + code (default, current behaviour)
  //   "skip"     — no code at all, phone optional (notifications only)
  otpMode?: "required" | "skip";
  schedulingEnabled?: boolean;
  schedulingMinDaysAhead?: number;
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

/** A custom website page (beyond the built-in home + order pages). */
export type WebsitePage = {
  slug: string;
  label: string;
  sortOrder: number;
};

export type WebsiteConfig = {
  // Theme system (menu/order page)
  themeId: string;
  pairingId: string;
  brandColor: string | null;
  layoutDefault: 'compact' | 'magazine';

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
  navbarStyle?: 'solid' | 'transparent' | 'custom' | 'hidden';
  navbarColor?: string;
  logoSize?: number;
  hideNavbarName?: boolean;
  /** Hides the restaurant logo image overlaid on the hero cover (mobile, above the name). */
  hideHeroLogo?: boolean;
  /** Background of the rounded-square logo box on the order-page hero. Default 'white'. */
  heroLogoBg?: 'white' | 'black';
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
  };
  /** Font family applied to the restaurant name overlay on the order/menu hero. */
  heroNameFont?: string;
  /** Per-restaurant override for the category section divider style on the order page. */
  categoryBannerStyle?: 'image-overlay' | 'text-block' | 'striped-rule' | 'none';
  /** Darkness (0-100) of the dark veil over image-overlay banners. Defaults to 40; 0 disables it. */
  categoryBannerOverlay?: number;
  /** Per-role typography overrides (overall size scale + per-role font/size) for the order/menu page. */
  typography?: import("./themes/typography").TypographyOverrides | null;
  /** Custom pages (beyond home + order). Each renders at /r/<slug>/<page.slug> and appears in the nav. */
  pages?: WebsitePage[] | null;
  /** When false, /r/<slug> redirects to /r/<slug>/order instead of rendering the landing page. */
  landingEnabled?: boolean;
  /** Optional checkout-form builder config. When absent/null the foodyweb checkout falls back to the legacy hard-coded flow. */
  checkoutConfig?: CheckoutConfig | null;
  /** Order-page info placement (metadata bar per mode + "Plus" modal sections). When absent foodyweb uses its default item set. */
  orderPageInfo?: OrderPageInfo | null;
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
};

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
};
