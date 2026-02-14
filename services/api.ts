import {
  MenuItem,
  MenuResponse,
  OrderPayload,
  OrderResponse,
  OrderSource,
  OrderStatus,
  OrderType,
  PaymentStatus,
  Restaurant,
  SessionGuest,
  TableOrder,
  TableSession,
} from "@/lib/types";
import { CURRENCY_CODE } from "@/lib/constants";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";
const API_PREFIX = `${API_BASE}/api/v1`;
const PUBLIC_PREFIX = `${API_PREFIX}/public`;
const WS_BASE = process.env.NEXT_PUBLIC_WS_BASE_URL ?? API_BASE.replace(/^http/, "ws");
const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN;

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const message = await res.text();
    throw new ApiError(message || "API error", res.status);
  }
  return res.json() as Promise<T>;
}

function authHeaders(): HeadersInit | undefined {
  return API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : undefined;
}

export async function fetchRestaurants() {
  // prefer public list; fallback to protected if token provided
  const url = API_TOKEN ? `${API_PREFIX}/restaurants` : `${PUBLIC_PREFIX}/restaurants`;
  const res = await fetch(url, { headers: authHeaders() });
  return handleResponse<{ restaurants: { id: number; name: string; slug?: string }[] }>(res);
}

export async function fetchRestaurant(idOrSlug: string): Promise<Restaurant> {
  const res = await fetch(`${PUBLIC_PREFIX}/restaurants/${idOrSlug}`, {
    cache: "no-store",
    next: { revalidate: 0 }
  });
  const data = await handleResponse<{ restaurant: any }>(res);
  return {
    id: data.restaurant.id,
    name: data.restaurant.name,
    slug: data.restaurant.slug,
    address: data.restaurant.address,
    logoUrl: data.restaurant.logo_url,
    coverUrl: data.restaurant.cover_url,
    backgroundColor: data.restaurant.background_color || undefined,
    description: data.restaurant.description,
    phone: data.restaurant.phone,
    openingHours: data.restaurant.opening_hours,
    deliveryEnabled: data.restaurant.delivery_enabled ?? false,
    pickupEnabled: data.restaurant.pickup_enabled ?? true,
    requireDineInPrepayment: data.restaurant.require_dine_in_prepayment ?? false,
    serviceMode: data.restaurant.service_mode || undefined,
  };
}

export async function fetchMenu(restaurantId: string): Promise<MenuResponse> {
  const res = await fetch(`${PUBLIC_PREFIX}/menu?restaurant_id=${restaurantId}`, {
    cache: "no-store",
    next: { revalidate: 0 }
  });
  const data = await handleResponse<{
    categories: Array<{ id: number; name?: string; Name?: string; items?: any[]; Items?: any[] }>;
  }>(res);
  const categories = data.categories.map((c) => ({
    id: String(c.id),
    name: c.name || c.Name || "Category"
  }));
  const items: MenuItem[] = data.categories.flatMap((c) =>
    (c.items || c.Items || []).map((item: any) => ({
      id: String(item.id),
      name: item.name || item.Name,
      description: item.description || item.Description,
      price: Number(item.price ?? item.Price ?? 0),
      imageUrl: item.image_url || item.imageUrl,
      categoryId: String(c.id),
      available: item.is_active ?? item.IsActive ?? true,
      modifiers: (item.modifiers || item.Modifiers || [])
        .map((modifier: any) => {
          const actionRaw = (modifier.action ?? modifier.Action ?? "add").toString().toLowerCase();
          return {
            id: String(modifier.id ?? modifier.ID),
            name: modifier.name ?? modifier.Name ?? "Modifier",
            action: actionRaw === "remove" ? "remove" : "add",
            category: modifier.category ?? modifier.Category,
            priceDelta: Number(modifier.price_delta ?? modifier.PriceDelta ?? 0),
            isActive: modifier.is_active ?? modifier.IsActive ?? true
          };
        })
        .filter((modifier: any) => modifier.isActive !== false)
    }))
  );
  return {
    restaurantId,
    restaurantName: undefined,
    currency: CURRENCY_CODE,
    categories,
    items
  };
}

export async function createOrder(payload: OrderPayload): Promise<OrderResponse> {
  // Determine order source based on order type
  const orderSource = payload.orderType === "dine_in" ? "qr_dine_in" : "website_order";
  
  const res = await fetch(`${PUBLIC_PREFIX}/orders?restaurant_id=${payload.restaurantId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      order_source: orderSource,
      order_type: payload.orderType,
      session_id: payload.sessionId,
      guest_id: payload.guestId || undefined,
      guest_name: payload.guestName || undefined,
      table_code: payload.tableId,
      table_number: payload.tableId,
      customer_name: payload.customerName,
      customer_phone: payload.customerPhone,
      delivery_address: payload.deliveryAddress,
      delivery_notes: payload.deliveryNotes,
      external_metadata: payload.deliveryAddress ? {
        delivery_address: payload.deliveryAddress,
        delivery_notes: payload.deliveryNotes,
        customer_name: payload.customerName,
        customer_phone: payload.customerPhone,
      } : undefined,
      payment_method: payload.paymentMethod,
      payment_required: payload.paymentRequired,
      // Don't send payment_status when payment is required - server will set it to pending
      // and generate the payment URL
      payment_status: payload.paymentRequired ? undefined : (payload.paymentMethod === "pay_now" ? "paid" : "unpaid"),
      items: payload.items.map((i) => ({
        menu_item_id: Number(i.itemId),
        quantity: i.quantity,
        notes: i.note,
        modifiers: i.modifiers?.map((modifier) => ({
          modifier_id: Number(modifier.modifierId),
          applied: modifier.applied
        }))
      }))
    })
  });
  const data = await handleResponse<{ order: any; payment_url?: string }>(res);
  const orderStatus =
    (data.order.order_status as OrderStatus) ??
    (data.order.status as OrderStatus) ??
    "pending_review";
  const paymentStatus =
    (data.order.payment_status as PaymentStatus) ?? "unpaid";
  return {
    orderId: String(data.order.id),
    total: data.order.total_amount,
    currency: CURRENCY_CODE,
    orderSource: data.order.order_source,
    orderType: data.order.order_type,
    externalMetadata: data.order.external_metadata,
    orderStatus,
    paymentStatus,
    receiptToken: data.order.receipt_token,
    paymentUrl: data.payment_url,
  };
}

export async function fetchOrder(orderId: string, restaurantId: string): Promise<OrderResponse> {
  const res = await fetch(`${PUBLIC_PREFIX}/orders/${orderId}?restaurant_id=${restaurantId}`, {
    cache: "no-store"
  });
  const data = await handleResponse<{ order: any }>(res);
  const orderStatus =
    (data.order.order_status as OrderStatus) ??
    (data.order.status as OrderStatus) ??
    "pending_review";
  const paymentStatus =
    (data.order.payment_status as PaymentStatus) ?? "unpaid";
  return {
    orderId: String(data.order.id),
    total: data.order.total_amount,
    currency: CURRENCY_CODE,
    orderSource: data.order.order_source,
    orderType: data.order.order_type,
    externalMetadata: data.order.external_metadata,
    orderStatus,
    paymentStatus,
    receiptToken: data.order.receipt_token,
    tableCode: data.order.table_code || undefined,
    sessionId: data.order.session_id || undefined,
  };
}

// ============ Payment ============

export type InitPaymentResponse = {
  paymentUrl?: string;
  error?: string;
};

export async function initPayment(orderId: string, restaurantId: string): Promise<InitPaymentResponse> {
  const res = await fetch(`${PUBLIC_PREFIX}/orders/${orderId}/payment/init?restaurant_id=${restaurantId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const data = await handleResponse<{ payment_url?: string; error?: string }>(res);
  return {
    paymentUrl: data.payment_url,
    error: data.error,
  };
}

export function orderStatusWsUrl(orderId: string, restaurantId: string) {
  const tokenParam = API_TOKEN ? `&token=${encodeURIComponent(API_TOKEN)}` : "";
  // Prefer guest endpoint; tokenParam is optional fallback for staff debugging
  return `${WS_BASE}/ws/guest?restaurant_id=${restaurantId}&order_id=${orderId}${tokenParam ? `&${tokenParam.slice(1)}` : ""}`;
}

// ============ OTP Verification ============

export type SendOTPResponse = {
  message: string;
  expires_in: number;
};

export type VerifyOTPResponse = {
  verified: boolean;
  error?: string;
};

export async function sendOTP(phone: string): Promise<SendOTPResponse> {
  const res = await fetch(`${PUBLIC_PREFIX}/otp/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  return handleResponse<SendOTPResponse>(res);
}

export async function verifyOTP(phone: string, code: string): Promise<VerifyOTPResponse> {
  const res = await fetch(`${PUBLIC_PREFIX}/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code }),
  });
  return handleResponse<VerifyOTPResponse>(res);
}

// ============ Receipts ============

export type ReceiptData = {
  order: {
    id: number;
    receipt_token: string;
    customer_name: string;
    customer_phone: string;
    order_type: OrderType;
    order_source: OrderSource;
    order_status: OrderStatus;
    payment_status: PaymentStatus;
    table_code?: string;
    total_amount: number;
    created_at: string;
  };
  restaurant: {
    id: number;
    name: string;
    address: string;
    phone: string;
    logo_url?: string;
  };
  items: Array<{
    id: number;
    name: string;
    quantity: number;
    unit_price: number;
    total: number;
    notes?: string;
    modifiers?: Array<{
      name: string;
      action: string;
      price_delta: number;
    }>;
  }>;
};

export async function fetchReceipt(token: string): Promise<ReceiptData> {
  const res = await fetch(`${PUBLIC_PREFIX}/receipts/${token}`, {
    cache: "no-store",
  });
  return handleResponse<ReceiptData>(res);
}

export type OrderHistoryItem = {
  id: number;
  receipt_token: string;
  restaurant_id: number;
  order_type: OrderType;
  order_status: OrderStatus;
  payment_status: PaymentStatus;
  total_amount: number;
  item_count: number;
  created_at: string;
};

export async function fetchOrderHistory(
  phone: string,
  restaurantId?: string,
  limit?: number
): Promise<{ orders: OrderHistoryItem[] }> {
  const params = new URLSearchParams({ phone });
  if (restaurantId) params.set("restaurant_id", restaurantId);
  if (limit) params.set("limit", String(limit));
  
  const res = await fetch(`${PUBLIC_PREFIX}/orders/history?${params}`, {
    cache: "no-store",
  });
  return handleResponse<{ orders: OrderHistoryItem[] }>(res);
}

// ============ Table Session ============

export async function fetchTableSession(sessionId: string): Promise<TableSession> {
  const res = await fetch(`${PUBLIC_PREFIX}/sessions/${sessionId}`, {
    cache: "no-store",
  });
  const data = await handleResponse<{ session: TableSession }>(res);
  return data.session;
}

export async function joinTableSession(
  sessionId: string,
  displayName: string,
  avatarEmoji: string
): Promise<SessionGuest> {
  const res = await fetch(`${PUBLIC_PREFIX}/sessions/${sessionId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      display_name: displayName,
      avatar_emoji: avatarEmoji,
    }),
  });
  const data = await handleResponse<{ guest: SessionGuest }>(res);
  return data.guest;
}

export async function leaveTableSession(
  sessionId: string,
  guestId: string
): Promise<void> {
  const res = await fetch(`${PUBLIC_PREFIX}/sessions/${sessionId}/guests/${guestId}`, {
    method: "DELETE",
  });
  await handleResponse(res);
}

export async function fetchSessionOrders(sessionId: string): Promise<TableOrder[]> {
  const res = await fetch(`${PUBLIC_PREFIX}/sessions/${sessionId}/orders`, {
    cache: "no-store",
  });
  const data = await handleResponse<{ orders: TableOrder[] }>(res);
  return data.orders ?? [];
}

export function tableSessionWsUrl(sessionId: string) {
  return `${WS_BASE}/ws/table?session_id=${sessionId}`;
}
