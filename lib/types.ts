export type MenuCategory = {
  id: string;
  name: string;
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
};

export type OrderStatus =
  | "pending_review"
  | "accepted"
  | "rejected"
  | "in_kitchen"
  | "ready"
  | "served"
  | "cancelled";

export type PaymentStatus = "unpaid" | "pending" | "paid" | "refunded";

export type OrderSource =
  | "qr_dine_in"
  | "wolt"
  | "manual"
  | "website_order"
  | "unknown_external";

export type OrderType = "dine_in" | "delivery" | "pickup";

export type Restaurant = {
  id: number;
  name: string;
  slug?: string;
  address?: string;
  logoUrl?: string;
  coverUrl?: string;
  description?: string;
  phone?: string;
  openingHours?: string;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
};
