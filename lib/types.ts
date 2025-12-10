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
};

export type MenuResponse = {
  restaurantId: string;
  restaurantName?: string;
  currency: string;
  categories: MenuCategory[];
  items: MenuItem[];
};

export type CartLine = {
  item: MenuItem;
  quantity: number;
  note?: string;
};

export type OrderPayload = {
  restaurantId: string;
  tableId: string;
  sessionId?: string;
  items: Array<{
    itemId: string;
    quantity: number;
    note?: string;
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
