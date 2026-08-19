import {
  BatchFulfillmentConfigResponse,
  CourierTracking,
  MenuData,
  MenuItem,
  MenuResponse,
  ModifierSet,
  OrderDeliveryInfo,
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
  TourInfo,
  WebsiteSection,
} from "@/lib/types";
import { CURRENCY_CODE } from "@/lib/constants";
import { parseOrderPageInfo } from "@/lib/orderPageInfo";
import { useGuestAccount } from "@/store/useGuestAccount";

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

/** Current guest (Google) session token, read outside React. */
function guestToken(): string | null {
  try {
    return useGuestAccount.getState().token;
  } catch {
    return null;
  }
}

/** Merge the guest Bearer token into headers when the guest is signed in. */
function withGuestAuth(headers: Record<string, string> = {}): Record<string, string> {
  const token = guestToken();
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
}

export type GuestAuthAccount = {
  id: number;
  email: string;
  name: string;
  picture?: string;
  phone?: string;
  // Saved delivery address (set from past delivery orders / edited in the admin),
  // used to autofill the checkout for returning signed-in guests.
  address?: string;
  city?: string;
  floor?: string;
  apt?: string;
  entry_code?: string;
  delivery_notes?: string;
};

/** Refresh the signed-in guest's account (e.g. phone backfilled from orders). */
export async function fetchMe(): Promise<GuestAuthAccount | null> {
  if (!guestToken()) return null;
  const res = await fetch(`${PUBLIC_PREFIX}/me`, { headers: withGuestAuth() });
  if (!res.ok) return null;
  const data = await handleResponse<{ account: GuestAuthAccount }>(res);
  return data.account ?? null;
}

/** Exchange a Google ID token for a guest session. */
export async function googleLogin(
  idToken: string
): Promise<{ token: string; account: GuestAuthAccount }> {
  const res = await fetch(`${PUBLIC_PREFIX}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });
  return handleResponse<{ token: string; account: GuestAuthAccount }>(res);
}

export type GuestOrderItem = {
  menu_item_id: number;
  name: string;
  quantity: number;
  selected_variant_id?: number;
  combo_item_id?: number;
  combo_name?: string;
};
export type GuestOrder = {
  id: number;
  restaurant_id: number;
  created_at: string;
  total: number;
  items: GuestOrderItem[];
  // Present for the full history view; omitted/ignored by the reorder sheet.
  receipt_token?: string;
  order_type?: OrderType;
  order_status?: OrderStatus;
  payment_status?: PaymentStatus;
  item_count?: number;
  /**
   * Set when the order was placed on a delivery tour. Its items are the tour's
   * carte and the server checks every line of a reorder against it
   * (`tour_item_mismatch`), so a tour order can only be replayed onto that same
   * tour — and only while the tour is still open.
   */
  tour_id?: number;
};

/**
 * The signed-in guest's recent orders (for reorder + the account history page).
 * Pass `restaurantId` to scope to one restaurant, or omit it for every
 * restaurant the guest has ordered from. `limit` defaults server-side to 10.
 */
export async function fetchMyOrders(
  restaurantId?: string,
  limit?: number
): Promise<GuestOrder[]> {
  if (!guestToken()) return [];
  const params = new URLSearchParams();
  if (restaurantId) params.set("restaurant_id", restaurantId);
  if (limit) params.set("limit", String(limit));
  const qs = params.toString();
  const res = await fetch(`${PUBLIC_PREFIX}/me/orders${qs ? `?${qs}` : ""}`, {
    headers: withGuestAuth(),
  });
  const data = await handleResponse<{ orders: GuestOrder[] }>(res);
  return data.orders ?? [];
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
    coverFocalX: typeof data.restaurant.cover_focal_x === "number" ? data.restaurant.cover_focal_x : 50,
    coverFocalY: typeof data.restaurant.cover_focal_y === "number" ? data.restaurant.cover_focal_y : 50,
    backgroundColor: data.restaurant.background_color || undefined,
    description: data.restaurant.description,
    defaultLocale: data.restaurant.default_locale || undefined,
    phone: data.restaurant.phone,
    openingHours: data.restaurant.opening_hours,
    openingHoursConfig: data.restaurant.opening_hours_config || undefined,
    deliveryEnabled: data.restaurant.delivery_enabled ?? false,
    pickupEnabled: data.restaurant.pickup_enabled ?? true,
    dineInEnabled: data.restaurant.dine_in_enabled ?? true,
    requireDineInPrepayment: data.restaurant.require_dine_in_prepayment ?? false,
    aiAssistantEnabled: data.restaurant.ai_assistant_enabled ?? false,
    aiAssistantTrigger: data.restaurant.ai_assistant_trigger || "manual",
    aiAssistantTriggerDelay: data.restaurant.ai_assistant_trigger_delay ?? 45,
    serviceMode: data.restaurant.service_mode || undefined,
    rushMode: data.restaurant.rush_mode ?? false,
    ordersPaused: data.restaurant.orders_paused ?? false,
    tipsEnabled: data.restaurant.tips_enabled ?? true,
    otpMode: data.restaurant.otp_mode === 'skip' ? 'skip' : 'required',
    schedulingEnabled: data.restaurant.scheduling_enabled ?? false,
    schedulingMinDaysAhead: data.restaurant.scheduling_min_days_ahead ?? 1,
    schedulingMaxDaysAhead: data.restaurant.scheduling_max_days_ahead ?? 7,
    schedulingRequirePrepayment: data.restaurant.scheduling_require_prepayment ?? false,
    schedulingSlotDurationMinutes: data.restaurant.scheduling_slot_duration_minutes ?? 30,
    batchFulfillmentEnabled: data.restaurant.batch_fulfillment_enabled ?? false,
    minimumOrderDelivery: data.restaurant.minimum_order_delivery ?? 0,
    websiteConfig: data.restaurant.website_config ? {
      themeId: data.restaurant.website_config.theme_id || 'editorial-dark',
      pairingId: data.restaurant.website_config.pairing_id || 'modern-sans',
      brandColor: data.restaurant.website_config.brand_color || null,
      layoutDefault: data.restaurant.website_config.layout_default || 'magazine',
      layoutDefaultMobile: data.restaurant.website_config.layout_default_mobile || null,
      heroLayout: data.restaurant.website_config.hero_layout || 'standard',
      welcomeText: data.restaurant.website_config.welcome_text || undefined,
      tagline: data.restaurant.website_config.tagline || undefined,
      socialLinks: data.restaurant.website_config.social_links || undefined,
      showAddress: data.restaurant.website_config.show_address ?? true,
      showPhone: data.restaurant.website_config.show_phone ?? true,
      showHours: data.restaurant.website_config.show_hours ?? true,
      faviconURL: data.restaurant.website_config.favicon_url || undefined,
      heroCtaText: data.restaurant.website_config.hero_cta_text || undefined,
      midCtaEnabled: data.restaurant.website_config.mid_cta_enabled ?? true,
      midCtaTitle: data.restaurant.website_config.mid_cta_title || undefined,
      midCtaBody: data.restaurant.website_config.mid_cta_body || undefined,
      midCtaBtnText: data.restaurant.website_config.mid_cta_btn_text || undefined,
      footerText: data.restaurant.website_config.footer_text || undefined,
      navbarStyle: data.restaurant.website_config.navbar_style || undefined,
      navbarColor: data.restaurant.website_config.navbar_color || undefined,
      logoSize: data.restaurant.website_config.logo_size > 0 ? data.restaurant.website_config.logo_size : undefined,
      hideNavbarName: data.restaurant.website_config.hide_navbar_name ?? false,
      hideHeroLogo: data.restaurant.website_config.hide_hero_logo ?? false,
      heroLogoBg: data.restaurant.website_config.hero_logo_bg === 'black' ? 'black' : 'white',
      heroCoverLayout:
        data.restaurant.website_config.hero_cover_layout === 'logo' ||
        data.restaurant.website_config.hero_cover_layout === 'bare'
          ? data.restaurant.website_config.hero_cover_layout
          : 'card',
      heroLogoSize: data.restaurant.website_config.hero_logo_size > 0 ? data.restaurant.website_config.hero_logo_size : undefined,
      customPalette: data.restaurant.website_config.custom_palette || undefined,
      sectionColors: data.restaurant.website_config.section_colors || null,
      heroNameFont: data.restaurant.website_config.hero_name_font || undefined,
      categoryBannerStyle: data.restaurant.website_config.category_banner_style || undefined,
      categoryBannerOverlay: data.restaurant.website_config.category_banner_overlay ?? undefined,
      categoryBannerFit: data.restaurant.website_config.category_banner_fit || undefined,
      categoryBannerFitMobile: data.restaurant.website_config.category_banner_fit_mobile || undefined,
      typography: data.restaurant.website_config.typography ?? null,
      pages: Array.isArray(data.restaurant.website_config.pages)
        ? data.restaurant.website_config.pages
            .map((p: any) => ({ slug: String(p.slug), label: String(p.label ?? p.slug), sortOrder: p.sort_order ?? 0 }))
            .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
        : null,
      landingEnabled: data.restaurant.website_config.landing_enabled ?? true,
      storiesEnabled: data.restaurant.website_config.stories_enabled ?? false,
      navOrder: typeof data.restaurant.website_config.nav_order === 'string' ? data.restaurant.website_config.nav_order : '',
      checkoutConfig: data.restaurant.website_config.checkout_config ?? null,
      orderPageInfo: parseOrderPageInfo(data.restaurant.website_config.order_page_info),
    } : undefined,
    googlePlacesApiKey: typeof data.restaurant.google_places_api_key === 'string' ? data.restaurant.google_places_api_key : '',
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
        translations: m.translations || m.Translations || null,
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
      enabledVerbs: Array.isArray(s.enabled_verbs)
        ? s.enabled_verbs.map((v: any) => String(v))
        : [],
      sortOrder: Number(s.sort_order ?? 0),
      modifiers,
      translations: s.translations || s.Translations || null,
    });
  }
  return result;
}

function _mapCategories(rawCats: Array<{ id: number; name?: string; Name?: string; items?: any[]; Items?: any[] }>) {
  const categories = rawCats.map((c: any) => ({
    id: String(c.id),
    name: c.name || c.Name || "Category",
    imageUrl: c.image_url || c.imageUrl || "",
    focalX: typeof c.banner_focal_x === "number" ? c.banner_focal_x : 50,
    focalY: typeof c.banner_focal_y === "number" ? c.banner_focal_y : 50,
    bannerDesign: c.banner_design ?? null,
    translations: c.translations || c.Translations || null,
  }));
  const items: MenuItem[] = rawCats.flatMap((c) =>
    (c.items || c.Items || []).map((item: any) => ({
      id: String(item.id),
      name: item.name || item.Name,
      description: item.description || item.Description,
      portion: item.portion || item.Portion || undefined,
      price: Number(item.price ?? item.Price ?? 0),
      pricingMode: item.pricing_mode === 'by_weight' ? 'by_weight' : 'standard',
      pricePerKg: Number(item.price_per_kg ?? 0),
      estimatedWeightGrams: Number(item.estimated_weight_grams ?? 0),
      imageUrl: item.image_url || item.imageUrl,
      groupId: String(c.id),
      available: item.is_active ?? item.IsActive ?? true,
      availabilityState: item.availability_state || undefined,
      buildableCount: item.buildable_count ?? null,
      comboOnly: item.combo_only ?? false,
      allowNotes: item.allow_notes ?? null,
      comboAllowQuantity: item.combo_allow_quantity == null ? undefined : Boolean(item.combo_allow_quantity),
      itemType: item.item_type || 'food_and_beverage',
      translations: item.translations || item.Translations || null,
      comboSteps: (item.combo_steps || []).map((step: any) => ({
        id: Number(step.id),
        name: step.name || '',
        description: step.description || '',
        minPicks: Number(step.min_picks ?? 0),
        maxPicks: Number(step.max_picks ?? 0),
        sortOrder: Number(step.sort_order ?? 0),
        variantRules: (step.variant_rules || []).map((r: any) => ({
          variantLabel: r.variant_label || '',
          minPicks: Number(r.min_picks ?? 0),
          maxPicks: Number(r.max_picks ?? 0),
        })),
        maxPerItem: Number(step.max_per_item ?? 0),
        itemLimits: (step.item_limits || []).map((l: any) => ({
          menuItemId: Number(l.menu_item_id),
          maxQty: Number(l.max_qty ?? 0),
        })),
        items: (step.items || []).map((si: any) => ({
          id: Number(si.id),
          menuItemId: Number(si.menu_item_id),
          optionId: si.option_id != null ? Number(si.option_id) : null,
          priceDelta: Number(si.price_delta ?? 0),
          menuItem: si.menu_item ? {
            id: Number(si.menu_item.id),
            name: si.menu_item.name || '',
            description: si.menu_item.description || '',
            price: Number(si.menu_item.price ?? 0),
            imageUrl: si.menu_item.image_url || '',
            availabilityState: si.menu_item.availability_state || undefined,
            buildableCount: si.menu_item.buildable_count ?? null,
          } : undefined,
        })),
      })),
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
            translations: modifier.translations || modifier.Translations || null,
          };
        })
        .filter((modifier: any) => modifier.isActive !== false && !modifier.hideOnline),
      modifierSets: _mapModifierSets(item.modifier_sets || item.ModifierSets || []),
      optionSets: (item.option_sets || item.OptionSets || []).map((os: any) => ({
        id: Number(os.id),
        name: os.name || '',
        sortOrder: Number(os.sort_order ?? 0),
        translations: os.translations || os.Translations || null,
        options: (os.options || [])
          .filter((o: any) => o.is_active !== false)
          .map((o: any) => ({
            id: Number(o.id),
            name: o.name || '',
            price: Number(o.price ?? 0),
            onlinePrice: o.online_price != null ? Number(o.online_price) : null,
            portion: o.portion || o.Portion || undefined,
            isActive: o.is_active ?? true,
            sortOrder: Number(o.sort_order ?? 0),
            translations: o.translations || o.Translations || null,
          })),
      })).filter((os: any) => os.options.length > 0),
    }))
  );
  return { categories, items };
}

export async function fetchMenu(
  restaurantId: string,
  previewDate?: string
): Promise<MenuResponse> {
  // previewDate (YYYY-MM-DD) lets the restaurant operator preview the carte as it
  // will look on a future date (weekly rotation preview). It only changes which
  // items the server returns; the page renders preview as view-only.
  const params = new URLSearchParams({ restaurant_id: restaurantId });
  if (previewDate) params.set("preview_date", previewDate);
  const res = await fetch(`${PUBLIC_PREFIX}/menu?${params.toString()}`, {
    cache: "no-store",
    next: { revalidate: 0 }
  });
  const data = await handleResponse<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    menus: Array<{ id: number; name: string; groups?: any[]; categories?: any[] }>;
  }>(res);

  const menus = (data.menus ?? []).map((m) => {
    // Groups are the primary display structure. Fall back to categories (legacy) if no groups.
    const groupSource = m.groups ?? [];
    const catSource = m.categories ?? [];
    const source = groupSource.length > 0 ? groupSource : catSource;
    const { categories: groups, items } = _mapCategories(source);
    // Delivery tours no longer appear on the normal site: they are reachable only
    // through their dedicated link (see fetchTour). So `/public/menu` carries no
    // tour, and every entry here is a plain carte keyed on its menu id.
    const entryKey = `menu-${m.id}`;
    return { entryKey, id: m.id, name: m.name, groups, categories: groups, items };
  });

  // Flat lists for backward compat (single-menu rendering still works). They double
  // as a global lookup-by-id table; a carte shared by several menus would otherwise
  // repeat its items and groups, so collapse duplicates by id.
  const dedupeById = <T extends { id: string | number }>(rows: T[]): T[] => {
    const seen = new Set<string>();
    return rows.filter((row) => {
      const key = String(row.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const allGroups = dedupeById(menus.flatMap((m) => m.groups));
  const allItems = dedupeById(menus.flatMap((m) => m.items));

  return {
    restaurantId,
    restaurantName: undefined,
    currency: CURRENCY_CODE,
    menus,
    categories: allGroups,
    items: allItems,
  };
}

/**
 * A resolved delivery tour and its dedicated carte, or the reason it cannot be
 * shown. A tour is reachable ONLY through its dedicated link — it never appears
 * on the normal site — so this is the single entry point for one.
 *
 *  - `{ tour, menu }`  the tour is open: `menu` is a one-carte MenuResponse whose
 *                      single entry carries the `tour`, ready for <OrderExperience>.
 *  - `{ reason }`      the server answered 404: `tour_not_found` (unknown / wrong
 *                      restaurant / unpublished) or `tour_closed` (published but
 *                      outside its ordering window).
 *
 * Only a genuine transport/5xx failure throws; the two 404 reasons are returned
 * so the page can render a clear state instead of a crash.
 */
export type TourResult = { tour: TourInfo; menu: MenuResponse } | { reason: string };

export async function fetchTour(
  restaurantId: string,
  tourSlug: string
): Promise<TourResult> {
  const res = await fetch(
    `${PUBLIC_PREFIX}/tours/${encodeURIComponent(restaurantId)}/${encodeURIComponent(tourSlug)}`,
    { cache: "no-store", next: { revalidate: 0 } }
  );
  // 404 is an expected answer here, not an error: the tour is unknown or closed.
  if (res.status === 404) {
    let reason = "tour_not_found";
    try {
      const body = await res.json();
      if (body?.reason) reason = String(body.reason);
    } catch {
      // Non-JSON body — keep the default reason.
    }
    return { reason };
  }
  const data = await handleResponse<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tour: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    menu: { id: number; name: string; groups?: any[]; categories?: any[] };
  }>(res);

  const rawTour = data.tour ?? {};
  const tour: TourInfo = {
    id: rawTour.id,
    name: rawTour.name,
    slug: rawTour.slug ?? tourSlug,
    deliveryDate: rawTour.delivery_date,
    cutoffAt: rawTour.cutoff_at,
    cities: rawTour.cities ?? [],
    deliveryFee: rawTour.delivery_fee ?? 0,
    minOrder: rawTour.min_order ?? null,
    deliveryStart: rawTour.delivery_start ?? undefined,
    deliveryEnd: rawTour.delivery_end ?? undefined,
    requirePrepayment: !!rawTour.require_prepayment,
  };

  // Reuse the shared menu parser so the tour carte maps groups/items/variants
  // exactly like every other carte. Groups are primary; fall back to categories.
  const rawMenu = data.menu ?? { id: 0, name: tour.name, groups: [] };
  const source = (rawMenu.groups?.length ? rawMenu.groups : rawMenu.categories) ?? [];
  const { categories: groups, items } = _mapCategories(source);

  const entry: MenuData = {
    entryKey: `tour-${tour.id}`,
    id: rawMenu.id,
    name: rawMenu.name,
    groups,
    categories: groups,
    items,
    tour,
  };
  const menu: MenuResponse = {
    restaurantId,
    restaurantName: undefined,
    currency: CURRENCY_CODE,
    menus: [entry],
    categories: groups,
    items,
  };
  return { tour, menu };
}

export async function createOrder(payload: OrderPayload): Promise<OrderResponse> {
  // Determine order source based on order type
  const orderSource = payload.orderType === "dine_in" ? "qr_dine_in" : "website_order";
  
  const res = await fetch(`${PUBLIC_PREFIX}/orders?restaurant_id=${payload.restaurantId}`, {
    method: "POST",
    headers: withGuestAuth({ "Content-Type": "application/json" }),
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
      customer_email: payload.customerEmail || undefined,
      customer_locale: payload.customerLocale || undefined,
      delivery_address: payload.deliveryAddress,
      delivery_city: payload.deliveryCity,
      delivery_floor: payload.deliveryFloor,
      delivery_apt: payload.deliveryApt,
      delivery_entry_code: payload.deliveryEntryCode,
      delivery_latitude: payload.deliveryLatitude,
      delivery_longitude: payload.deliveryLongitude,
      delivery_notes: payload.deliveryNotes,
      custom_fields: payload.customFields && Object.keys(payload.customFields).length > 0 ? payload.customFields : undefined,
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
      // On a tour order the server derives the delivery date, window, fee and
      // minimum from the tour, and validates the address against its zone alone.
      tour_id: payload.tourId || undefined,
      items: payload.items.map((i) => ({
        menu_item_id: Number(i.itemId),
        quantity: i.quantity,
        notes: i.note,
        selected_variant_id: i.selectedVariantId || undefined,
        modifiers: i.modifiers?.map((modifier) => ({
          modifier_id: Number(modifier.modifierId),
          applied: modifier.applied
        }))
      })),
      // Combo / set-menu items
      combos: payload.combos?.map((c) => ({
        combo_item_id: c.comboItemId || undefined,
        notes: c.notes || undefined,
        selections: c.selections.map((sel) => ({
          step_id: sel.stepId,
          menu_item_id: sel.menuItemId,
          option_id: sel.optionId || undefined,
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

// ── AI ordering assistant ───────────────────────────────────────────────────

export interface AIChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AISuggestedItem {
  id: number;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  available: boolean;
  reason?: string;
}

export interface AIPlacedOrder {
  orderId: number;
  total: number;
  currency: string;
  paymentUrl?: string;
  status: string;
}

export interface AIChatResponse {
  message: string;
  suggestedItems: AISuggestedItem[];
  order?: AIPlacedOrder;
  /** tappable answer choices the assistant offers for its current question */
  quickReplies: string[];
  /** how many of quickReplies the guest may pick. max>1 = multi-select. */
  quickReplyMin: number;
  quickReplyMax: number;
  /** when set, the app should open its deterministic combo step-picker for this
   *  combo's menu item id (the assistant handed combo configuration to the UI). */
  configureComboId?: number;
}

/**
 * Send a turn to the guest-facing AI ordering assistant. The server is
 * stateless between calls, so `history` carries the prior conversation and
 * `message` is the new user turn. Returns the assistant reply plus any rich
 * item cards or placed-order/payment info produced by its tools.
 */
export async function sendAIOrderChat(params: {
  restaurantId: string;
  message: string;
  history: AIChatMessage[];
  orderType?: OrderType;
  /** foodyweb UI locale (en | he | fr) — the assistant replies in it */
  locale?: string;
  /** active carte id — scopes suggestions to the menu the guest is viewing */
  menuId?: number;
  /** exact item ids visible on the page now — hard allowlist for the assistant */
  visibleItemIds?: number[];
}): Promise<AIChatResponse> {
  const res = await fetch(
    `${PUBLIC_PREFIX}/ai/order-chat?restaurant_id=${params.restaurantId}`,
    {
      method: "POST",
      headers: withGuestAuth({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        message: params.message,
        history: params.history,
        order_type: params.orderType,
        locale: params.locale,
        menu_id: params.menuId,
        visible_item_ids: params.visibleItemIds,
      }),
    }
  );
  const data = await handleResponse<{
    message: string;
    suggested_items?: any[];
    order?: any;
    quick_replies?: string[];
    quick_reply_min?: number;
    quick_reply_max?: number;
    configure_combo_id?: number;
  }>(res);
  return {
    message: data.message ?? "",
    suggestedItems: (data.suggested_items ?? []).map((s) => ({
      id: Number(s.id),
      name: s.name ?? "",
      description: s.description ?? "",
      price: Number(s.price ?? 0),
      imageUrl: s.image_url ?? "",
      available: s.available !== false,
      reason: s.reason || undefined,
    })),
    quickReplies: (data.quick_replies ?? []).filter((q): q is string => typeof q === "string"),
    quickReplyMin: Number(data.quick_reply_min ?? 0),
    quickReplyMax: Number(data.quick_reply_max ?? 1),
    configureComboId: data.configure_combo_id ? Number(data.configure_combo_id) : undefined,
    order: data.order
      ? {
          orderId: Number(data.order.order_id),
          total: Number(data.order.total ?? 0),
          currency: data.order.currency ?? CURRENCY_CODE,
          paymentUrl: data.order.payment_url || undefined,
          status: data.order.status ?? "created",
        }
      : undefined,
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
    delivery: parseDeliveryInfo(data.order),
    orderStatus,
    paymentStatus,
    receiptToken: data.order.receipt_token,
    tableCode: data.order.table_code || undefined,
    sessionId: data.order.session_id || undefined,
  };
}

/**
 * Extracts courier / delivery info for the confirmation page from a public
 * order payload. The server places these under `external_metadata.delivery`
 * (preferred) but we also accept top-level `courier_*` fields for forward
 * compatibility. Returns null when there's nothing to show so the UI stays
 * empty rather than rendering a blank card.
 */
function parseDeliveryInfo(order: any): OrderDeliveryInfo | null {
  const src = order?.external_metadata?.delivery ?? order?.delivery ?? order;
  const courierName = src?.courier_name ?? src?.courierName;
  const courierPhone = src?.courier_phone ?? src?.courierPhone;
  const etaStart = src?.eta_start ?? src?.etaStart;
  const etaEnd = src?.eta_end ?? src?.etaEnd;
  const note = src?.note ?? src?.delivery_note ?? src?.deliveryNote;
  const info: OrderDeliveryInfo = {};
  if (courierName) info.courierName = String(courierName);
  if (courierPhone) info.courierPhone = String(courierPhone);
  if (etaStart) info.etaStart = String(etaStart);
  if (etaEnd) info.etaEnd = String(etaEnd);
  if (note) info.note = String(note);
  return Object.keys(info).length > 0 ? info : null;
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

export async function sendOTP(phone: string, restaurantId: number): Promise<SendOTPResponse> {
  const res = await fetch(`${PUBLIC_PREFIX}/otp/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, restaurant_id: restaurantId }),
  });
  return handleResponse<SendOTPResponse>(res);
}

export async function verifyOTP(phone: string, code: string, restaurantId: number): Promise<VerifyOTPResponse> {
  const res = await fetch(`${PUBLIC_PREFIX}/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code, restaurant_id: restaurantId }),
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
    selected_variant_name?: string;
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

/** Marker error thrown by joinTableSession when the server returns 410 Gone
 *  with `{error: "session_expired"}`. The caller can branch on this to show
 *  a specific "this table session has ended — scan the QR again" prompt. */
export class SessionExpiredError extends Error {
  constructor(message?: string) {
    super(message || "session_expired");
    this.name = "SessionExpiredError";
  }
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
  // 410 Gone with `{error: "session_expired"}` is the server's signal that
  // the table session has ended (status != active, or past the absolute
  // 12h lifetime cap). Surface it distinctly so the UI can guide the
  // customer to re-scan the QR.
  if (res.status === 410) {
    let body: { error?: string; message?: string } = {};
    try {
      body = await res.json();
    } catch {
      // Non-JSON body — fall through with empty message.
    }
    throw new SessionExpiredError(body.message);
  }
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
  type RawDay = {
    date: string;
    day_name: string;
    pickup_window?: { start: string; end: string };
    delivery_window?: { start: string; end: string };
  };
  const data = await handleResponse<{
    enabled: boolean;
    ordering_open: boolean;
    current_batch_open_at?: string;
    current_batch_cutoff: string;
    cutoff_day_name: string;
    cutoff_time: string;
    open_day_name?: string;
    open_time?: string;
    fulfillment_days: RawDay[];
    next_batch_open_at?: string;
    next_batch_cutoff?: string;
    next_fulfillment_days?: RawDay[];
    upcoming_cycles?: Array<{
      open_at: string;
      cutoff_at: string;
      fulfillment_days: RawDay[];
    }>;
    require_prepayment: boolean;
  }>(res);
  const mapDay = (d: RawDay) => ({
    date: d.date,
    dayName: d.day_name,
    pickupWindow: d.pickup_window,
    deliveryWindow: d.delivery_window,
  });
  return {
    enabled: data.enabled,
    orderingOpen: data.ordering_open,
    currentBatchOpenAt: data.current_batch_open_at ?? "",
    currentBatchCutoff: data.current_batch_cutoff,
    cutoffDayName: data.cutoff_day_name,
    cutoffTime: data.cutoff_time,
    openDayName: data.open_day_name ?? "",
    openTime: data.open_time ?? "",
    fulfillmentDays: (data.fulfillment_days || []).map(mapDay),
    nextBatchOpenAt: data.next_batch_open_at ?? "",
    nextBatchCutoff: data.next_batch_cutoff ?? "",
    nextFulfillmentDays: (data.next_fulfillment_days || []).map(mapDay),
    upcomingCycles: (data.upcoming_cycles || []).map((c) => ({
      openAt: c.open_at,
      cutoffAt: c.cutoff_at,
      fulfillmentDays: (c.fulfillment_days || []).map(mapDay),
    })),
    requirePrepayment: data.require_prepayment,
  };
}

/**
 * Fetch the delivery cities configured for a restaurant, or — when `tourId` is
 * given — that tour's own cities, which are the only ones it delivers to.
 */
export async function fetchDeliveryCities(restaurantId: string, tourId?: number): Promise<string[]> {
  const q = new URLSearchParams({ restaurant_id: restaurantId });
  if (tourId) q.set("tour_id", String(tourId));
  const res = await fetch(`${PUBLIC_PREFIX}/delivery/cities?${q.toString()}`);
  if (!res.ok) return [];
  const data = await handleResponse<{ cities: string[] }>(res);
  return data.cities ?? [];
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

// ============ Courier Tracking ============

/** Live courier position for the customer's order. Returns null when the
 *  server's privacy gate is not met (not out-for-delivery / ShowCourier off /
 *  no courier location). Maps the snake_case server payload to camelCase. */
export async function fetchCourierTracking(
  orderId: string,
  restaurantId: string,
): Promise<CourierTracking | null> {
  const res = await fetch(
    `${PUBLIC_PREFIX}/delivery/track?restaurant_id=${restaurantId}&order_id=${orderId}`,
    { cache: "no-store" },
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await handleResponse<{ tracking: any }>(res);
  const tr = data?.tracking;
  if (!tr) return null;
  return {
    courierFirstName: tr.courier_first_name ?? undefined,
    courierLat: Number(tr.courier_lat),
    courierLng: Number(tr.courier_lng),
    destLat: tr.dest_lat != null ? Number(tr.dest_lat) : undefined,
    destLng: tr.dest_lng != null ? Number(tr.dest_lng) : undefined,
    etaSeconds: tr.eta_seconds != null ? Number(tr.eta_seconds) : undefined,
  };
}

// ============ Delivery Zone Check ============

/**
 * Check whether a given address/coordinates falls within the restaurant's
 * configured delivery zone. Returns `deliverable` (in zone), `resolved`
 * (server was able to resolve the zone), and `reason` (human-readable
 * explanation for why delivery is or is not available).
 *
 * Supply `lat`/`lng` when the caller has already geocoded the address
 * (e.g. from Google Places Autocomplete). Supply `address`/`city` as text
 * fallback — the server will geocode internally. At least one of the two
 * forms should be provided.
 */
export type DeliveryCheckResult = {
  deliverable: boolean;
  resolved: boolean;
  /**
   * Why delivery is or is not available.
   *
   * A tour check (`tourId` set) answers with its OWN reasons, never the ordinary
   * ones: `tour_not_found`, `tour_closed`, `tour_address_outside_zone`,
   * `tour_address_unresolved`. Only `tour_address_unresolved` sets
   * `resolved: false`. Do not match tour answers against `outside_zone` /
   * `address_unresolved` — those never come back on a tour.
   */
  reason: string;
  /** Flat delivery fee: the matched zone's, or the tour's own (0 when free / no match). */
  delivery_fee?: number;
  /** Minimum cart subtotal; null when it defers to the global minimum. */
  min_order?: number | null;
  /** Ordinary zone checks only. A tour answer carries neither zone_id nor zone_name. */
  zone_id?: number;
  zone_name?: string;
};

export async function checkDeliveryAddress(params: {
  restaurantId: string;
  lat?: number;
  lng?: number;
  address?: string;
  city?: string;
  /** On a tour, the address is validated against THAT tour's zone alone. */
  tourId?: number;
}): Promise<DeliveryCheckResult> {
  const q = new URLSearchParams({ restaurant_id: params.restaurantId });
  if (params.lat != null && params.lng != null) {
    q.set('lat', String(params.lat));
    q.set('lng', String(params.lng));
  }
  if (params.address) q.set('address', params.address);
  if (params.city) q.set('city', params.city);
  if (params.tourId) q.set('tour_id', String(params.tourId));
  const res = await fetch(`${PUBLIC_PREFIX}/delivery/check?${q.toString()}`);
  return handleResponse<DeliveryCheckResult>(res);
}

// ─── Stories / Reels ─────────────────────────────────────────────────────────

export interface Reel {
  id: number;
  provider: string;
  externalId: string;
  /** Direct (short-lived) media URL from the platform; prefer `streamUrl` to play. */
  mediaUrl: string;
  /** Embed/permalink URL (TikTok embed player; IG permalink). */
  embedUrl: string;
  thumbnailUrl: string;
  caption: string;
  permalink: string;
  sortOrder: number;
  publishedAt?: string | null;
  /** Server proxy that 302s to a always-fresh media URL (handles IG CDN TTL). */
  streamUrl: string;
}

/** Fetches the customer-facing reels for a restaurant's Stories page. */
export async function fetchReels(idOrSlug: string): Promise<Reel[]> {
  const res = await fetch(`${PUBLIC_PREFIX}/restaurants/${idOrSlug}/reels`, {
    cache: "no-store",
    next: { revalidate: 0 },
  });
  const data = await handleResponse<{ reels: any[] }>(res);
  return (data.reels || []).map((r) => ({
    id: r.id,
    provider: r.provider,
    externalId: r.external_id,
    mediaUrl: r.media_url,
    embedUrl: r.embed_url,
    thumbnailUrl: r.thumbnail_url,
    caption: r.caption,
    permalink: r.permalink,
    sortOrder: r.sort_order,
    publishedAt: r.published_at,
    streamUrl: `${PUBLIC_PREFIX}/restaurants/${idOrSlug}/reels/${r.id}/stream`,
  }));
}
