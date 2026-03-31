import {
  BatchFulfillmentConfigResponse,
  ComboMenu,
  MenuItem,
  MenuResponse,
  ModifierSet,
  OrderPayload,
  OrderResponse,
  OrderSource,
  OrderStatus,
  OrderType,
  PaymentStatus,
  Restaurant,
  SchedulingConfigResponse,
  SessionGuest,
  TableOrder,
  TableSession,
  WebsiteSection,
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
    const raw = await res.text();
    let message = raw || "API error";
    // Try to extract a human-readable message from JSON error responses
    try {
      const parsed = JSON.parse(raw);
      message = parsed.details || parsed.message || parsed.error || raw;
    } catch {
      // Not JSON, use raw text
    }
    throw new ApiError(message, res.status);
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
    timezone: data.restaurant.timezone || undefined,
    logoUrl: data.restaurant.logo_url,
    coverUrl: data.restaurant.cover_url,
    coverDisplayMode: data.restaurant.cover_display_mode || "cover",
    backgroundColor: data.restaurant.background_color || undefined,
    description: data.restaurant.description,
    phone: data.restaurant.phone,
    openingHours: data.restaurant.opening_hours,
    openingHoursConfig: data.restaurant.opening_hours_config || undefined,
    deliveryEnabled: data.restaurant.delivery_enabled ?? false,
    pickupEnabled: data.restaurant.pickup_enabled ?? true,
    requireDineInPrepayment: data.restaurant.require_dine_in_prepayment ?? false,
    serviceMode: data.restaurant.service_mode || undefined,
    rushMode: data.restaurant.rush_mode ?? false,
    tipsEnabled: data.restaurant.tips_enabled ?? true,
    schedulingEnabled: data.restaurant.scheduling_enabled ?? false,
    schedulingMinDaysAhead: data.restaurant.scheduling_min_days_ahead ?? 1,
    schedulingMaxDaysAhead: data.restaurant.scheduling_max_days_ahead ?? 7,
    schedulingRequirePrepayment: data.restaurant.scheduling_require_prepayment ?? false,
    schedulingSlotDurationMinutes: data.restaurant.scheduling_slot_duration_minutes ?? 30,
    batchFulfillmentEnabled: data.restaurant.batch_fulfillment_enabled ?? false,
    minimumOrderDelivery: data.restaurant.minimum_order_delivery ?? 0,
    websiteConfig: data.restaurant.website_config ? {
      primaryColor: data.restaurant.website_config.primary_color || '#EB5204',
      secondaryColor: data.restaurant.website_config.secondary_color || '#C94400',
      backgroundColor: data.restaurant.website_config.background_color || '',
      fontFamily: data.restaurant.website_config.font_family || 'Nunito Sans',
      heroLayout: data.restaurant.website_config.hero_layout || 'standard',
      welcomeText: data.restaurant.website_config.welcome_text || undefined,
      tagline: data.restaurant.website_config.tagline || undefined,
      socialLinks: data.restaurant.website_config.social_links || undefined,
      showAddress: data.restaurant.website_config.show_address ?? true,
      showPhone: data.restaurant.website_config.show_phone ?? true,
      showHours: data.restaurant.website_config.show_hours ?? true,
      themeMode: data.restaurant.website_config.theme_mode || 'light',
      faviconURL: data.restaurant.website_config.favicon_url || undefined,
      heroCtaText: data.restaurant.website_config.hero_cta_text || undefined,
      midCtaEnabled: data.restaurant.website_config.mid_cta_enabled ?? true,
      midCtaTitle: data.restaurant.website_config.mid_cta_title || undefined,
      midCtaBody: data.restaurant.website_config.mid_cta_body || undefined,
      midCtaBtnText: data.restaurant.website_config.mid_cta_btn_text || undefined,
      footerText: data.restaurant.website_config.footer_text || undefined,
      menuLayout: data.restaurant.website_config.menu_layout || undefined,
      cartStyle: data.restaurant.website_config.cart_style || undefined,
      navbarStyle: data.restaurant.website_config.navbar_style || undefined,
      navbarColor: data.restaurant.website_config.navbar_color || undefined,
      logoSize: data.restaurant.website_config.logo_size > 0 ? data.restaurant.website_config.logo_size : undefined,
      hideNavbarName: data.restaurant.website_config.hide_navbar_name ?? false,
    } : undefined,
    websiteSections: Array.isArray(data.restaurant.website_sections)
      ? data.restaurant.website_sections.map((s: any) => ({
          id: s.id,
          sectionType: s.section_type,
          page: s.page || 'home',
          sortOrder: s.sort_order,
          isVisible: s.is_visible,
          layout: s.layout,
          content: s.content || {},
          settings: s.settings || {},
        }))
      : undefined,
  };
}

/** Maps raw modifier set objects from the API into typed [ModifierSet] values.
 *  Defensively filters out modifiers where hide_online is true (server already
 *  strips these from the public API, but we guard client-side as well).
 *  Sets where all modifiers are hidden are dropped entirely.
 */
function _mapModifierSets(rawSets: any[]): ModifierSet[] {
  const result: ModifierSet[] = [];
  for (const s of rawSets) {
    const modifiers = (s.modifiers || [])
      .map((m: any) => ({
        id: String(m.id ?? ""),
        name: m.name ?? "",
        action: ((m.action ?? "add") as string).toLowerCase() === "remove" ? "remove" as const : "add" as const,
        priceDelta: Number(m.price_delta ?? 0),
        isActive: m.is_active ?? true,
        isPreselected: !!(m.is_preselected ?? false),
        hideOnline: !!(m.hide_online ?? false),
        sortOrder: m.sort_order ?? 0,
      }))
      .filter((m: any) => m.isActive && !m.hideOnline);
    if (modifiers.length === 0) continue;
    result.push({
      id: String(s.id ?? ""),
      name: s.name ?? "",
      displayName: s.display_name ?? "",
      isRequired: !!(s.is_required ?? false),
      allowMultiple: s.allow_multiple ?? true,
      minSelections: Number(s.min_selections ?? 0),
      maxSelections: Number(s.max_selections ?? 0),
      hideOnReceipt: !!(s.hide_on_receipt ?? false),
      useConversational: !!(s.use_conversational ?? false),
      sortOrder: Number(s.sort_order ?? 0),
      modifiers,
    });
  }
  return result;
}

function _mapCategories(rawCats: Array<{ id: number; name?: string; Name?: string; items?: any[]; Items?: any[] }>) {
  const categories = rawCats.map((c) => ({
    id: String(c.id),
    name: c.name || c.Name || "Category"
  }));
  const items: MenuItem[] = rawCats.flatMap((c) =>
    (c.items || c.Items || []).map((item: any) => ({
      id: String(item.id),
      name: item.name || item.Name,
      description: item.description || item.Description,
      price: Number(item.price ?? item.Price ?? 0),
      imageUrl: item.image_url || item.imageUrl,
      categoryId: String(c.id),
      available: item.is_active ?? item.IsActive ?? true,
      comboOnly: item.combo_only ?? false,
      modifiers: (item.modifiers || item.Modifiers || [])
        .map((modifier: any) => {
          const actionRaw = (modifier.action ?? modifier.Action ?? "add").toString().toLowerCase();
          return {
            id: String(modifier.id ?? modifier.ID),
            name: modifier.name ?? modifier.Name ?? "Modifier",
            action: actionRaw === "remove" ? "remove" : ("add" as const),
            category: modifier.category ?? modifier.Category,
            priceDelta: Number(modifier.price_delta ?? modifier.PriceDelta ?? 0),
            isActive: modifier.is_active ?? modifier.IsActive ?? true,
            maxSelection: Number(modifier.max_selection ?? modifier.MaxSelection ?? 0),
            isRequired: !!(modifier.is_required ?? modifier.IsRequired ?? false),
            freeQuantity: Number(modifier.free_quantity ?? modifier.FreeQuantity ?? 0),
            extraPrice: Number(modifier.extra_price ?? modifier.ExtraPrice ?? 0),
            isPreselected: !!(modifier.is_preselected ?? false),
            hideOnline: !!(modifier.hide_online ?? false),
          };
        })
        .filter((modifier: any) => modifier.isActive !== false && !modifier.hideOnline),
      modifierSets: _mapModifierSets(item.modifier_sets || item.ModifierSets || [])
    }))
  );
  return { categories, items };
}

export async function fetchMenu(restaurantId: string): Promise<MenuResponse> {
  const res = await fetch(`${PUBLIC_PREFIX}/menu?restaurant_id=${restaurantId}`, {
    cache: "no-store",
    next: { revalidate: 0 }
  });
  const data = await handleResponse<{
    menus: Array<{ id: number; name: string; categories: any[] }>;
  }>(res);

  const menus = (data.menus ?? []).map((m) => {
    const { categories, items } = _mapCategories(m.categories ?? []);
    return { id: m.id, name: m.name, categories, items };
  });

  // Flat lists for backward compat (single-menu rendering still works)
  const allCategories = menus.flatMap((m) => m.categories);
  const allItems = menus.flatMap((m) => m.items);

  return {
    restaurantId,
    restaurantName: undefined,
    currency: CURRENCY_CODE,
    menus,
    categories: allCategories,
    items: allItems,
  };
}

/**
 * Fetch active combo / set menus for a restaurant (public, no auth).
 */
export async function fetchCombos(restaurantId: string): Promise<ComboMenu[]> {
  const res = await fetch(`${PUBLIC_PREFIX}/combos?restaurant_id=${restaurantId}`, {
    cache: "no-store",
    next: { revalidate: 0 }
  });
  const data = await handleResponse<{ combos: any[] }>(res);
  return (data.combos || []).map((c: any) => ({
    id: c.id,
    name: c.name || "",
    description: c.description || "",
    price: Number(c.price ?? 0),
    imageUrl: c.image_url || c.imageUrl || "",
    isActive: c.is_active ?? true,
    sortOrder: c.sort_order ?? 0,
    steps: (c.steps || []).map((s: any) => ({
      id: s.id,
      name: s.name || "",
      minPicks: s.min_picks ?? 0,
      maxPicks: s.max_picks ?? 0,
      sortOrder: s.sort_order ?? 0,
      items: (s.items || []).map((si: any) => ({
        id: si.id,
        menuItemId: si.menu_item_id,
        priceDelta: Number(si.price_delta ?? 0),
        menuItem: {
          id: si.menu_item?.id ?? si.menu_item_id,
          name: si.menu_item?.name || "",
          description: si.menu_item?.description || "",
          price: Number(si.menu_item?.price ?? 0),
          imageUrl: si.menu_item?.image_url || si.menu_item?.imageUrl || "",
        },
      })),
    })),
  }));
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
      delivery_city: payload.deliveryCity,
      delivery_floor: payload.deliveryFloor,
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
      is_scheduled: payload.isScheduled || undefined,
      scheduled_for: payload.scheduledFor || undefined,
      scheduled_pickup_window_start: payload.scheduledPickupWindowStart || undefined,
      scheduled_pickup_window_end: payload.scheduledPickupWindowEnd || undefined,
      items: payload.items.map((i) => ({
        menu_item_id: Number(i.itemId),
        quantity: i.quantity,
        notes: i.note,
        modifiers: i.modifiers?.map((modifier) => ({
          modifier_id: Number(modifier.modifierId),
          applied: modifier.applied
        }))
      })),
      // Combo / set-menu items
      combos: payload.combos?.map((c) => ({
        combo_menu_id: c.comboMenuId,
        notes: c.notes || undefined,
        selections: c.selections.map((sel) => ({
          step_id: sel.stepId,
          menu_item_id: sel.menuItemId,
          quantity: sel.quantity,
          notes: sel.notes || undefined,
        })),
      })) || undefined,
    })
  });
  const data = await handleResponse<{ order: any; payment_url?: string; service_mode?: string }>(res);
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
    serviceMode: data.service_mode,
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

// ============ Session Payment (table bill) ============

export type SessionPaymentMode = "my_orders" | "full_table" | "split_equal";

export type InitSessionPaymentRequest = {
  mode: SessionPaymentMode;
  guestId?: string;
  splitCount?: number;
  tipAmount?: number;
};

export type InitSessionPaymentResponse = {
  paymentUrl?: string;
  orderIds?: number[];
  totalAmount?: number;
  tipAmount?: number;
  mode?: string;
  error?: string;
};

export async function initSessionPayment(
  sessionId: string,
  restaurantId: string,
  req: InitSessionPaymentRequest
): Promise<InitSessionPaymentResponse> {
  const res = await fetch(
    `${PUBLIC_PREFIX}/sessions/${sessionId}/pay?restaurant_id=${restaurantId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: req.mode,
        guest_id: req.guestId,
        split_count: req.splitCount,
        tip_amount: req.tipAmount || 0,
      }),
    }
  );
  const data = await handleResponse<{
    payment_url?: string;
    order_ids?: number[];
    total_amount?: number;
    tip_amount?: number;
    mode?: string;
    error?: string;
  }>(res);
  return {
    paymentUrl: data.payment_url,
    orderIds: data.order_ids,
    totalAmount: data.total_amount,
    tipAmount: data.tip_amount,
    mode: data.mode,
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
    combo_group?: string;
    combo_name?: string;
    combo_price?: number;
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

export async function fetchSchedulingConfig(
  restaurantId: string,
  from: string,
  to: string,
  orderType?: string
): Promise<SchedulingConfigResponse> {
  const otParam = orderType ? `&order_type=${orderType}` : "";
  const res = await fetch(
    `${PUBLIC_PREFIX}/restaurants/${restaurantId}/scheduling-config?from=${from}&to=${to}${otParam}`,
    { cache: "no-store", next: { revalidate: 0 } }
  );
  const data = await handleResponse<{
    enabled: boolean;
    slot_duration_minutes: number;
    require_prepayment: boolean;
    slots_by_date: Record<string, Array<{ start: string; end: string }>>;
  }>(res);
  return {
    enabled: data.enabled,
    slotDurationMinutes: data.slot_duration_minutes,
    requirePrepayment: data.require_prepayment,
    slotsByDate: data.slots_by_date,
  };
}

export async function fetchBatchFulfillmentConfig(
  restaurantId: string | number
): Promise<BatchFulfillmentConfigResponse> {
  const res = await fetch(
    `${PUBLIC_PREFIX}/restaurants/${restaurantId}/batch-fulfillment-config`,
    { cache: "no-store", next: { revalidate: 0 } }
  );
  const data = await handleResponse<{
    enabled: boolean;
    ordering_open: boolean;
    current_batch_cutoff: string;
    cutoff_day_name: string;
    cutoff_time: string;
    fulfillment_days: Array<{
      date: string;
      day_name: string;
      pickup_window?: { start: string; end: string };
      delivery_window?: { start: string; end: string };
    }>;
    require_prepayment: boolean;
  }>(res);
  return {
    enabled: data.enabled,
    orderingOpen: data.ordering_open,
    currentBatchCutoff: data.current_batch_cutoff,
    cutoffDayName: data.cutoff_day_name,
    cutoffTime: data.cutoff_time,
    fulfillmentDays: (data.fulfillment_days || []).map((d) => ({
      date: d.date,
      dayName: d.day_name,
      pickupWindow: d.pickup_window,
      deliveryWindow: d.delivery_window,
    })),
    requirePrepayment: data.require_prepayment,
  };
}

/** Check if a phone number is a trusted customer for a restaurant. */
export async function checkTrustedCustomer(
  restaurantId: string,
  phone: string
): Promise<boolean> {
  const res = await fetch(
    `${PUBLIC_PREFIX}/customers/check-trusted?restaurant_id=${restaurantId}&phone=${encodeURIComponent(phone)}`
  );
  const data = await handleResponse<{ trusted: boolean }>(res);
  return data.trusted;
}

