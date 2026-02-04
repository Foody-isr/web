import {
  MenuItem,
  MenuResponse,
  OrderPayload,
  OrderResponse,
  OrderStatus,
  PaymentStatus,
} from "@/lib/types";

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
  return handleResponse<{ restaurants: { id: number; name: string }[] }>(res);
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
    currency: "USD",
    categories,
    items
  };
}

export async function createOrder(payload: OrderPayload): Promise<OrderResponse> {
  const res = await fetch(`${PUBLIC_PREFIX}/orders?restaurant_id=${payload.restaurantId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      order_source: "qr_dine_in",
      order_type: "dine_in",
      session_id: payload.sessionId,
      table_code: payload.tableId,
      table_number: payload.tableId,
      external_metadata: undefined,
      payment_method: payload.paymentMethod,
      payment_status: payload.paymentMethod === "pay_now" ? "paid" : "unpaid",
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
    currency: "USD",
    orderSource: data.order.order_source,
    orderType: data.order.order_type,
    externalMetadata: data.order.external_metadata,
    orderStatus,
    paymentStatus,
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
    currency: "USD",
    orderSource: data.order.order_source,
    orderType: data.order.order_type,
    externalMetadata: data.order.external_metadata,
    orderStatus,
    paymentStatus,
  };
}

export function orderStatusWsUrl(orderId: string, restaurantId: string) {
  const tokenParam = API_TOKEN ? `&token=${encodeURIComponent(API_TOKEN)}` : "";
  // Prefer guest endpoint; tokenParam is optional fallback for staff debugging
  return `${WS_BASE}/ws/guest?restaurant_id=${restaurantId}&order_id=${orderId}${tokenParam ? `&${tokenParam.slice(1)}` : ""}`;
}
