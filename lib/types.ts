export type MenuCategory = {
  id: string;
  name: string;
  description?: string;
  slug?: string;
};

export type MenuItem = {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  categoryId: string;
  tags?: string[];
  available?: boolean;
  modifiers?: MenuItemModifier[];
};

export type MenuItemModifier = {
  id: string;
  name: string;
  action: "add" | "remove";
  category?: string;
  priceDelta: number;
  isActive?: boolean;
};

export type MenuResponse = {
  restaurantId: string;
  restaurantName?: string;
  currency: string;
  categories: MenuCategory[];
  items: MenuItem[];
};

export type CartLine = {
  id: string;
  item: MenuItem;
  quantity: number;
  note?: string;
  modifiers?: MenuItemModifier[];
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
  deliveryNotes?: string;
  items: Array<{
    itemId: string;
    quantity: number;
    note?: string;
    modifiers?: Array<{
      modifierId: string;
      applied: boolean;
    }>;
  }>;
  paymentMethod: "pay_now" | "pay_later";
  paymentRequired?: boolean;
  splitByItemIds?: string[];
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
};

export type OrderStatus =
  | "pending_review"
  | "accepted"
  | "rejected"
  | "in_kitchen"
  | "ready"
  | "ready_for_pickup"
  | "ready_for_delivery"
  | "out_for_delivery"
  | "served"
  | "received" // NEW: Unified dine-in completion status
  | "picked_up"
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
  backgroundColor?: string; // Hex color (e.g. "#FF5733") for solid background
  description?: string;
  phone?: string;
  openingHours?: string; // Legacy text format
  openingHoursConfig?: OpeningHoursConfig; // Structured opening hours
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  requireDineInPrepayment?: boolean; // If true, dine-in guests must pay before order is sent
  serviceMode?: "counter" | "table"; // counter = day mode (customer picks up), table = night mode (waiter delivers)
};
