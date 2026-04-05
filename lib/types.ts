/** A menu group (display container for items within a menu). */
export type MenuGroup = {
  id: string;
  name: string;
  description?: string;
  slug?: string;
  imageUrl?: string;
};

/** @deprecated Use MenuGroup instead. */
export type MenuCategory = MenuGroup;

export type ItemType = 'food_and_beverage' | 'combo';

export type MenuItem = {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  /** The menu group this item belongs to (for display grouping). */
  groupId: string;
  tags?: string[];
  available?: boolean;
  comboOnly?: boolean;
  /** Item type: 'food_and_beverage' (default) or 'combo'. */
  itemType?: ItemType;
  /** Combo steps (only present when itemType === 'combo'). */
  comboSteps?: ComboStep[];
  modifiers?: MenuItemModifier[];
  /** Square-compatible modifier sets. Use these when present. */
  modifierSets?: ModifierSet[];
  /** Reusable option sets (e.g. "Sizes" shared across items). First option is default. */
  optionSets?: OptionSetType[];
};

/** A reusable option set attached to a menu item. */
export type OptionSetType = {
  id: number;
  name: string;
  sortOrder: number;
  options: OptionSetOptionType[];
};

/** A single option within an option set. Price is absolute. */
export type OptionSetOptionType = {
  id: number;
  name: string;
  price: number;
  onlinePrice?: number | null;
  isActive: boolean;
  sortOrder: number;
};

export type MenuItemModifier = {
  id: string;
  name: string;
  action: "add" | "remove";
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
  sortOrder: number;
  modifiers: ModifierSetModifier[];
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
  deliveryNotes?: string;
  items: Array<{
    itemId: string;
    quantity: number;
    note?: string;
    selectedVariantId?: number;
    modifiers?: Array<{
      modifierId: string;
      applied: boolean;
    }>;
  }>;
  paymentMethod: "pay_now" | "pay_later" | "cash";
  paymentRequired?: boolean;
  splitByItemIds?: string[];
  // Combo items
  combos?: Array<{
    comboMenuId?: number;
    comboItemId?: number;
    selections: Array<{
      stepId: number;
      menuItemId: number;
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

export type OrderResponse = {
  orderId: string;
  total: number;
  currency: string;
  orderSource?: OrderSource;
  orderType?: OrderType;
  externalMetadata?: Record<string, any> | null;
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
  backgroundColor?: string; // Hex color (e.g. "#FF5733") for solid background
  description?: string;
  phone?: string;
  openingHours?: string; // Legacy text format
  openingHoursConfig?: OpeningHoursConfig; // Structured opening hours
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  requireDineInPrepayment?: boolean; // If true, dine-in guests must pay before order is sent
  serviceMode?: "counter" | "table"; // counter = day mode (customer picks up), table = night mode (waiter delivers)
  rushMode?: boolean; // When true, restaurant is temporarily paused
  tipsEnabled?: boolean; // When false, skip the tip step for customers
  schedulingEnabled?: boolean;
  schedulingMinDaysAhead?: number;
  schedulingMaxDaysAhead?: number;
  schedulingRequirePrepayment?: boolean;
  schedulingSlotDurationMinutes?: number;
  batchFulfillmentEnabled?: boolean;
  minimumOrderDelivery?: number;
  websiteConfig?: WebsiteConfig;
  websiteSections?: WebsiteSection[];
};

// ============ Website Config ============

export type WebsiteConfig = {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  fontFamily: string;
  heroLayout: 'standard' | 'minimal' | 'fullscreen';
  welcomeText?: string;
  tagline?: string;
  socialLinks?: Record<string, string>;
  showAddress: boolean;
  showPhone: boolean;
  showHours: boolean;
  themeMode?: 'light' | 'dark';
  faviconURL?: string;
  heroCtaText?: string;
  midCtaEnabled?: boolean;
  midCtaTitle?: string;
  midCtaBody?: string;
  midCtaBtnText?: string;
  footerText?: string;
  menuLayout?: 'list' | 'grid';
  cartStyle?: 'bar-bottom' | 'fab-right' | 'tab-right';
  navbarStyle?: 'solid' | 'transparent' | 'custom' | 'hidden';
  navbarColor?: string;
  logoSize?: number;
  hideNavbarName?: boolean;
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

export type BatchFulfillmentConfigResponse = {
  enabled: boolean;
  orderingOpen: boolean;
  currentBatchCutoff: string; // ISO 8601 datetime
  cutoffDayName: string;      // e.g. "Wednesday" — in restaurant timezone
  cutoffTime: string;         // "HH:MM" — in restaurant timezone
  fulfillmentDays: BatchFulfillmentDayInfo[];
  requirePrepayment: boolean;
};
