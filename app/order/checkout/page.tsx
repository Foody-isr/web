"use client";

import { Suspense } from "react";
import { useCartStore } from "@/store/useCartStore";
import { useI18n } from "@/lib/i18n";
import { useHydrated } from "@/hooks/useHydrated";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  createOrder,
  chargeCibus,
  fetchMenu,
  fetchTour,
  sendOTP,
  verifyOTP,
  fetchRestaurant,
  fetchSchedulingConfig,
  fetchBatchFulfillmentConfig,
  checkTrustedCustomer,
  fetchMe,
  checkDeliveryAddress,
  fetchDeliveryCities,
  isImmediateItem,
} from "@/services/api";
import { BatchFulfillmentConfigResponse, CheckoutConfig, OrderPayload, OrderType, Restaurant, SchedulingConfigResponse, SchedulingTimeSlot } from "@/lib/types";
import { formatModifierLabel, isByWeight, lineTotal, lineUnitPrice } from "@/lib/cart";
import { computeLineAvailability, type ItemAvailability, type LineAvailability } from "@/lib/cart-availability";
import { tField } from "@/lib/translations";
import { useMenuLanguage } from "@/lib/menu-language";
import { checkAvailability } from "@/lib/availability";
import { LanguageToggle } from "@/components/LanguageToggle";
import CheckoutBuilderFields from "@/components/CheckoutBuilderFields";
import { OrderDetailsModal, SchedulingIntent } from "@/components/OrderDetailsModal";
import { resolveCheckoutForm } from "@/lib/checkout-fields";
import { VAT_MULTIPLIER, CURRENCY_SYMBOL, currencySymbol } from "@/lib/constants";
import { useTableSession } from "@/store/useTableSession";
import { useGuestAuth } from "@/store/useGuestAuth";
import { useGuestAccount } from "@/store/useGuestAccount";
import { GoogleSignIn } from "@/components/GoogleSignIn";
import { addDays, formatDateLabel, formatWeekday } from "@/lib/scheduling";

type CheckoutStep = "details" | "verify" | "confirm";

// Country code options
const COUNTRY_CODES = [
  { code: "+972", country: "IL", flag: "🇮🇱" },
  { code: "+1", country: "US", flag: "🇺🇸" },
  { code: "+44", country: "GB", flag: "🇬🇧" },
  { code: "+49", country: "DE", flag: "🇩🇪" },
  { code: "+33", country: "FR", flag: "🇫🇷" },
  { code: "+39", country: "IT", flag: "🇮🇹" },
  { code: "+34", country: "ES", flag: "🇪🇸" },
  { code: "+7", country: "RU", flag: "🇷🇺" },
  { code: "+86", country: "CN", flag: "🇨🇳" },
  { code: "+81", country: "JP", flag: "🇯🇵" },
  { code: "+82", country: "KR", flag: "🇰🇷" },
  { code: "+91", country: "IN", flag: "🇮🇳" },
  { code: "+61", country: "AU", flag: "🇦🇺" },
  { code: "+55", country: "BR", flag: "🇧🇷" },
  { code: "+52", country: "MX", flag: "🇲🇽" },
];

// Loading component
function CheckoutLoading() {
  return (
    <main className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-12 h-12 bg-brand/20 rounded-full" />
        <div className="h-4 w-32 bg-neutral-200 rounded" />
      </div>
    </main>
  );
}

// Main page wrapped in Suspense
export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutLoading />}>
      <CheckoutContent />
    </Suspense>
  );
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, direction, locale } = useI18n();
  const { menuLocale, configure: configureMenuLanguage } = useMenuLanguage();
  const hydrated = useHydrated();
  const skipOtpEnabled = process.env.NEXT_PUBLIC_SKIP_OTP_ENABLED === "true";

  // Extract params
  const restaurantId = searchParams.get("restaurantId") || "";
  const tableId = searchParams.get("tableId") || undefined;
  const sessionId = searchParams.get("sessionId") || undefined;

  // A tour cart is a delivery round: the type is not the customer's to choose,
  // the day is fixed, and the deliverable cities are the tour's own. The CART is
  // what is being checked out, so its tour wins over anything the URL says —
  // ?orderType=pickup on a tour cart is stale, not an instruction.
  //
  // Read through `hydrated`, exactly like `lines` below: the cart is persisted in
  // localStorage and only exists on the client. `isTour` drives JSX (the order
  // type row, the tour day line, the fee, the button label), so reading it raw
  // renders the ordinary branch on the server and the tour branch on the client
  // — a hydration mismatch on every single tour checkout.
  const persistedTourId = useCartStore((s) => s.tourId);
  const cartTourId = hydrated ? persistedTourId : undefined;
  // The tour is served only through its dedicated slug endpoint, so the cart
  // carries the slug to let the checkout re-resolve the tour below. Read through
  // `hydrated` exactly like `tourId`: it lives in localStorage.
  const persistedTourSlug = useCartStore((s) => s.tourSlug);
  const cartTourSlug = hydrated ? persistedTourSlug : undefined;
  const tourIdParam = searchParams.get("tourId");
  const tourId = cartTourId ?? (tourIdParam ? Number(tourIdParam) : undefined);
  const isTour = !!tourId;
  const orderType: OrderType = isTour
    ? "delivery"
    : ((searchParams.get("orderType") as OrderType) || "pickup");
  // When embedded in the foodyadmin Checkout editor iframe, ?preview=1 disables
  // the cart-empty redirect and lets the parent override checkout_config via
  // postMessage so the owner sees their draft live without publishing.
  const previewMode = searchParams.get("preview") === "1";
  const [previewConfig, setPreviewConfig] = useState<CheckoutConfig | null>(null);
  const [previewPlacesKey, setPreviewPlacesKey] = useState<string>("");

  // Scheduling params pre-filled from the Order Details modal on the restaurant page
  const scheduledFromUrl = searchParams.get("isScheduled") === "true";
  const scheduledForFromUrl = searchParams.get("scheduledFor") || null;
  const slotStartFromUrl = searchParams.get("scheduledPickupWindowStart") || null;
  const slotEndFromUrl = searchParams.get("scheduledPickupWindowEnd") || null;

  // Cart state
  const lines = useCartStore((s) => s.lines);
  const total = useCartStore((s) => s.total);
  const currency = useCartStore((s) => s.currency);
  // Display symbol (₪, $, €…) for the order's currency code. Falls back to the
  // code itself for unknown currencies. Used for all price displays below.
  const currencyLabel = currencySymbol(currency);
  const clear = useCartStore((s) => s.clear);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);

  // Restaurant data
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);

  // Form state
  const [step, setStep] = useState<CheckoutStep>("details");
  // Optional split-name first-name field (built-in "customer_first_name"). When
  // the owner's checkout form uses it, it's prepended to customerName at submit
  // so the order still carries a single composed customer_name.
  const [customerFirstName, setCustomerFirstName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+972");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryFloor, setDeliveryFloor] = useState("");
  const [deliveryApt, setDeliveryApt] = useState("");
  const [deliveryEntryCode, setDeliveryEntryCode] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [pickupNotes, setPickupNotes] = useState("");
  const [deliveryLatLng, setDeliveryLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [deliveryCities, setDeliveryCities] = useState<string[]>([]);

  // Delivery zone check state
  type ZoneStatus = 'idle' | 'checking' | 'ok' | 'blocked';
  const [zoneStatus, setZoneStatus] = useState<ZoneStatus>('idle');
  const [zoneReason, setZoneReason] = useState<string>('');
  // Per-zone delivery fee + minimum resolved by the deliverability check.
  // zoneMinOrder is null when the matched zone defers to the global minimum.
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [zoneMinOrder, setZoneMinOrder] = useState<number | null>(null);

  // Values for owner-defined custom fields, keyed by field id. Empty when the
  // restaurant is on the legacy hard-coded checkout (or has no custom fields).
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string | boolean>>({});

  // OTP state
  const [otpCode, setOtpCode] = useState("");
  const [otpExpiry, setOtpExpiry] = useState(0);
  const [otpError, setOtpError] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [orderPlaced, setOrderPlaced] = useState(false);

  // Whether the editable order-type summary modal is open (lets the user
  // change pickup/delivery and scheduling without going back to the menu).
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false);

  // Scheduling state — pre-filled from URL params set by the Order Details modal.
  // A tour has no scheduling to speak of: its delivery date IS the fulfillment
  // date, so any scheduling intent left in the URL by an earlier ordinary cart is
  // dropped rather than carried into a round it does not apply to.
  const [isScheduled, setIsScheduled] = useState(isTour ? false : scheduledFromUrl);
  const [scheduledFor, setScheduledFor] = useState<string | null>(isTour ? null : scheduledForFromUrl);
  const [selectedSlot, setSelectedSlot] = useState<SchedulingTimeSlot | null>(
    !isTour && slotStartFromUrl && slotEndFromUrl ? { start: slotStartFromUrl, end: slotEndFromUrl } : null
  );
  const [schedulingConfig, setSchedulingConfig] = useState<SchedulingConfigResponse | null>(null);
  const [schedulingLoading, setSchedulingLoading] = useState(false);

  // The initial state above is computed on the first render, where the cart's
  // tour is not readable yet (it lives in localStorage, behind `hydrated`). A
  // tour that only becomes known once the cart hydrates must drop the scheduling
  // the URL carried all the same: the round's day IS the fulfillment date.
  useEffect(() => {
    if (!isTour) return;
    setIsScheduled(false);
    setScheduledFor(null);
    setSelectedSlot(null);
  }, [isTour]);

  // Batch fulfillment state
  const [batchConfig, setBatchConfig] = useState<BatchFulfillmentConfigResponse | null>(null);

  // Trusted customer / cash payment state
  const [isTrustedCustomer, setIsTrustedCustomer] = useState(false);
  const [paymentChoice, setPaymentChoice] = useState<"card" | "cash" | "cibus">("card");
  const [cibusCardCode, setCibusCardCode] = useState("");

  // Computed values
  const displayLines = hydrated ? lines : [];
  const displayTotal = hydrated ? total() : 0;
  // Any by-weight line means the final charge depends on the actual weighed
  // portion; we surface a hold/estimate acknowledgment near the order total.
  const hasByWeightLines = displayLines.some((line) => isByWeight(line.item));
  const totalItems = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity, 0),
    [lines]
  );

  // Fresh availability — re-checked at checkout so an item that sold out since being
  // added to the cart is caught before the customer pays, not only by the server guard.
  const { data: freshMenu, refetch: refetchAvailability } = useQuery({
    queryKey: ["checkout-availability", restaurantId],
    queryFn: () => fetchMenu(restaurantId),
    enabled: !!restaurantId,
    staleTime: 0,
  });
  const availabilityMap = useMemo(() => {
    const map = new Map<string, ItemAvailability>();
    for (const item of freshMenu?.items ?? []) {
      map.set(item.id, {
        state: item.availabilityState,
        buildableCount: item.buildableCount,
        available: item.available,
      });
    }
    return map;
  }, [freshMenu]);
  // A tour is fulfilled on its own future day, exactly like a scheduled order: it
  // is not gated on today's opening hours or today's sold-out state.
  const futureFulfillment = isTour || isScheduled;
  // "Disponible maintenant" — the immediate-sale channel. The cart is immediate
  // when every line is an immediate-sale item in its current window (surplus once
  // the cutoff has passed, standalone always). Such a cart is fulfilled same-day
  // and bypasses the batch cutoff; mixing it with pre-order lines is rejected.
  const batchClosed =
    !!restaurant?.batchFulfillmentEnabled && !!batchConfig?.enabled && !batchConfig.orderingOpen;
  const cartIsImmediate =
    hydrated && lines.length > 0 && lines.every((l) => isImmediateItem(l.item, batchClosed));
  const cartMixed =
    lines.some((l) => isImmediateItem(l.item, batchClosed)) && !cartIsImmediate;
  // Scheduled and batch-fulfillment orders target a future date, so today's sold-out
  // state isn't the right gate — mirror the mutation, which skips the real-time check
  // for them. Leave the per-line map empty so nothing is flagged or blocked. Immediate
  // carts DO get the real-time check: live count stock is exactly their gate.
  const availabilityCheckEnabled =
    (!futureFulfillment && !restaurant?.batchFulfillmentEnabled) || cartIsImmediate;
  const lineAvailability = useMemo(() => {
    const map = new Map<string, LineAvailability>();
    if (!hydrated || !availabilityCheckEnabled) return map;
    for (const line of lines) {
      map.set(line.id, computeLineAvailability(line, availabilityMap));
    }
    return map;
  }, [hydrated, lines, availabilityMap, availabilityCheckEnabled]);
  const hasBlockedLines = useMemo(
    () => Array.from(lineAvailability.values()).some((s) => s.status !== "ok"),
    [lineAvailability]
  );

  // The tour this cart was built from. A tour is no longer part of `/public/menu`
  // (freshMenu above never carries one now); it is served only through its own
  // slug endpoint, so it is re-resolved here by the slug the cart carries. The
  // endpoint answers with the open tour, or a `reason` once it has closed —
  // stating "the round is over" beats letting the server answer with a 422.
  const { data: tourResult } = useQuery({
    queryKey: ["checkout-tour", restaurantId, cartTourSlug],
    queryFn: () => fetchTour(restaurantId, cartTourSlug!),
    enabled: isTour && !!cartTourSlug,
    staleTime: 0,
  });
  const tour = tourResult && "tour" in tourResult ? tourResult.tour : undefined;
  // Only a settled query answers the question, so the checkout is never blocked
  // while it loads: `tourResult` is set only once the fetch resolves. A `reason`
  // (tour_closed / tour_not_found) or a missing tour then means the round shut
  // while the form was being filled in.
  const tourExpired = isTour && !!tourResult && !tour;
  // A tour can demand payment up front. When it does there is nothing to
  // arbitrate: the round is bought before it leaves, so the trusted-customer cash
  // option is not offered.
  const tourRequiresPrepayment = isTour && !!tour?.requirePrepayment;

  /**
   * The round closed while the customer was filling the form.
   *
   * Stating it is not enough: the button is disabled, the cart holds items from a
   * carte nothing will accept any more, and every path forward from this page is
   * shut. Only the menu page empties an expired tour cart, so a customer who
   * never navigates back sits on a dead checkout with no way out. Hand them the
   * exit here, in the one place they are actually standing.
   */
  const tourExpiredNotice = tourExpired ? (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
      <p className="flex-1 text-sm text-red-600 text-start">{t("tourOrderClosed")}</p>
      <button
        type="button"
        onClick={() => {
          clear();
          router.push(`/r/${restaurantId}`);
        }}
        className="text-sm font-semibold text-red-700 underline whitespace-nowrap hover:opacity-80"
      >
        {t("tourEmptyCart")}
      </button>
    </div>
  ) : null;

  // The fixed day of the round, worded exactly as the menu-page banner words it.
  // The customer chooses none of this: they read it.
  const tourDayLine = tour ? (
    <p className="mt-2 text-sm text-[var(--text-muted)] text-start">
      {t("tourDeliveryOn").replace("{date}", formatDateLabel(tour.deliveryDate, locale, { lowerRelative: true }))}
      {tour.deliveryStart && tour.deliveryEnd ? `, ${tour.deliveryStart} - ${tour.deliveryEnd}` : ""}
    </p>
  ) : null;

  // Minimum order check for delivery. Suppressed once the order is placed: on
  // success we clear() the cart, which zeroes displayTotal and would otherwise
  // flash the "below minimum" banner for a frame before the redirect completes.
  // On a tour the minimum is the tour's own; otherwise the per-zone minimum
  // (resolved from the delivery address) overrides the restaurant's global
  // minimum, and the global applies when the zone leaves it unset.
  const globalMinimumOrderDelivery = restaurant?.minimumOrderDelivery ?? 0;
  const minimumOrderDelivery = (isTour ? tour?.minOrder : null) ?? zoneMinOrder ?? globalMinimumOrderDelivery;
  const isBelowMinimum = !orderPlaced && orderType === "delivery" && minimumOrderDelivery > 0 && displayTotal < minimumOrderDelivery;

  // Delivery fee applies only to deliverable delivery orders. The grand total
  // (what the customer pays) is the item total plus the fee; the server
  // independently resolves and charges the same fee, so this is display-only.
  //
  // On a tour the fee is the tour's flat fee, not any zone's. `TourInfo.deliveryFee`
  // is always a number (api.ts maps `delivery_fee ?? 0`), so the only thing the
  // fallback covers is the tour not being resolved yet — and in that state the
  // fee is not quoted anyway: either the menu is still loading, or the tour has
  // expired and the checkout is blocked.
  const resolvedDeliveryFee = isTour ? tour?.deliveryFee ?? 0 : deliveryFee;
  const appliedDeliveryFee = orderType === "delivery" && zoneStatus === "ok" ? resolvedDeliveryFee : 0;
  const grandTotal = displayTotal + appliedDeliveryFee;

  // Why the address was refused. A tour check answers with its OWN reasons and
  // never with the ordinary ones, so both sets have to be handled here.
  // `*_unresolved` means "we could not locate this address" — a request for a
  // finer one, not a refusal — on both paths.
  const zoneBlockedMessage = (() => {
    switch (zoneReason) {
      case "address_unresolved":
      case "tour_address_unresolved":
        return t("deliveryRefineAddress");
      case "tour_address_outside_zone":
        return t("tourAddressOutside");
      case "tour_closed":
        return t("tourOrderClosed");
      case "tour_not_found":
        return t("tourUnavailable");
      default:
        return isTour ? t("tourAddressOutside") : t("deliveryOutsideZone");
    }
  })();

  // Delivery fee / zone feedback shown right after the city field (both the
  // builder and legacy forms) so the customer sees the fee before filling in
  // the rest of the address — not buried at the bottom of the form. Before a
  // city is chosen, a generic heads-up explains the fee can vary by city (only
  // when the restaurant uses a city list, i.e. fees can actually differ). A tour
  // has one flat fee, so that heads-up would be a lie: it is skipped.
  const deliveryFeeNotice = orderType !== "delivery" ? null : !deliveryCity.trim() ? (
    deliveryCities.length > 0 && !isTour ? (
      <p className="text-xs text-[var(--text-muted)]">
        {t("deliveryFeeVariesHint")}
      </p>
    ) : null
  ) : (
    <>
      {zoneStatus === "ok" && (
        <div className="flex items-center justify-between rounded-xl bg-[var(--surface-subtle)] px-4 py-2.5 text-sm">
          <span className="text-[var(--text-muted)]">{t("deliveryFee")}</span>
          <span className="font-semibold">
            {appliedDeliveryFee > 0 ? `${currencyLabel} ${appliedDeliveryFee.toFixed(2)}` : t("free")}
          </span>
        </div>
      )}
      {zoneStatus === "blocked" && (
        <p className="text-sm text-red-500">{zoneBlockedMessage}</p>
      )}
    </>
  );

  const checkoutBlocked = hasBlockedLines || isBelowMinimum || tourExpired || cartMixed;

  // Normalize phone number with country code
  const normalizePhone = (phone: string) => {
    if (!phone.trim()) return "";
    return phone.startsWith("+") ? phone : `${countryCode}${phone.replace(/^0/, "")}`;
  };

  // Fetch restaurant on mount
  useEffect(() => {
    if (restaurantId) {
      fetchRestaurant(restaurantId).then(setRestaurant).catch(console.error);
    }
  }, [restaurantId]);

  // Scope the menu-language choice (original vs translated) to this restaurant
  // so the order summary shows item names in the same language as the menu.
  useEffect(() => {
    if (restaurant) configureMenuLanguage(restaurant.id, restaurant.defaultLocale);
  }, [configureMenuLanguage, restaurant]);

  // Countdown timer for OTP
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Guest auth — skip OTP if already verified for this restaurant
  const guestIsVerified = useGuestAuth((s) => s.isVerified(restaurantId));
  const guestPhone = useGuestAuth((s) => s.getPhone(restaurantId));
  const setGuestVerified = useGuestAuth((s) => s.setVerified);

  // For dine-in, skip straight to confirm step — name already provided when joining table
  useEffect(() => {
    if (orderType === "dine_in") {
      const { guestName } = useTableSession.getState();
      if (guestName) {
        setCustomerName(guestName);
      }
      setPhoneVerified(true);
      setStep("confirm");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderType]);

  // If guest is already verified via the auth store, pre-fill phone and skip OTP
  useEffect(() => {
    if (orderType === "dine_in") return;
    if (guestIsVerified && guestPhone) {
      setCustomerPhone(guestPhone.replace(/^\+972/, ""));
      setPhoneVerified(true);
      // Check trusted status for returning verified guests
      if (orderType === "pickup" || orderType === "delivery") {
        checkTrustedCustomer(restaurantId, guestPhone)
          .then(setIsTrustedCustomer)
          .catch(() => {});
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestIsVerified, guestPhone]);

  // Prefill the form from a signed-in guest account (Google). Optional — never
  // blocks anonymous checkout. Doesn't overwrite anything the guest already typed.
  const guestAccount = useGuestAccount((s) => s.account);
  const guestToken = useGuestAccount((s) => s.token);
  const setGuestAccount = useGuestAccount((s) => s.setAccount);
  // Refresh the account on load so phone (backfilled from past orders) is current.
  useEffect(() => {
    if (!guestToken) return;
    fetchMe()
      .then((a) => a && setGuestAccount(a))
      .catch(() => {});
  }, [guestToken, setGuestAccount]);
  useEffect(() => {
    if (!guestAccount) return;
    if (guestAccount.name) setCustomerName((prev) => prev || guestAccount.name);
    if (guestAccount.email) setCustomerEmail((prev) => prev || guestAccount.email);
    if (guestAccount.phone) {
      setCustomerPhone((prev) => prev || guestAccount.phone!.replace(/^\+972/, ""));
    }
    // Autofill the saved delivery address for returning guests (delivery only).
    // Never overwrites anything the guest already typed.
    if (orderType === "delivery") {
      if (guestAccount.address) setDeliveryAddress((prev) => prev || guestAccount.address!);
      if (guestAccount.city) setDeliveryCity((prev) => prev || guestAccount.city!);
      if (guestAccount.floor) setDeliveryFloor((prev) => prev || guestAccount.floor!);
      if (guestAccount.apt) setDeliveryApt((prev) => prev || guestAccount.apt!);
      if (guestAccount.entry_code) setDeliveryEntryCode((prev) => prev || guestAccount.entry_code!);
      if (guestAccount.delivery_notes) setDeliveryNotes((prev) => prev || guestAccount.delivery_notes!);
    }
  }, [guestAccount, orderType]);

  // Redirect if cart is empty (but not after order is placed). Skipped in
  // preview mode so the foodyadmin editor can show the form without a cart.
  useEffect(() => {
    if (previewMode) return;
    if (hydrated && lines.length === 0 && !orderPlaced) {
      router.push(`/r/${restaurantId}`);
    }
  }, [hydrated, lines.length, restaurantId, router, orderPlaced, previewMode]);

  // Preview channel: listen for config updates from the foodyadmin parent
  // iframe. The parent posts { type: 'foody-checkout-preview', checkoutConfig,
  // googlePlacesApiKey } any time the owner edits a field.
  useEffect(() => {
    if (!previewMode) return;
    function onMessage(e: MessageEvent) {
      const data = e.data;
      if (!data || data.type !== "foody-checkout-preview") return;
      setPreviewConfig((data.checkoutConfig as CheckoutConfig | null) ?? null);
      if (typeof data.googlePlacesApiKey === "string") {
        setPreviewPlacesKey(data.googlePlacesApiKey);
      }
    }
    window.addEventListener("message", onMessage);
    // Tell the parent we're ready to receive the first config payload.
    window.parent?.postMessage({ type: "foody-checkout-preview-ready" }, "*");
    return () => window.removeEventListener("message", onMessage);
  }, [previewMode]);

  // Fetch scheduling config when schedule toggle is enabled. Never on a tour:
  // the day is the tour's and there is nothing to pick.
  useEffect(() => {
    if (isTour || !isScheduled || !restaurantId || !restaurant) return;
    const minDays = restaurant.schedulingMinDaysAhead ?? 1;
    const maxDays = restaurant.schedulingMaxDaysAhead ?? 7;
    const today = new Date();
    const fromDate = addDays(today, minDays);
    const toDate = addDays(today, maxDays);
    setSchedulingLoading(true);
    setSchedulingConfig(null);
    fetchSchedulingConfig(restaurantId, fromDate, toDate, orderType)
      .then(setSchedulingConfig)
      .catch(console.error)
      .finally(() => setSchedulingLoading(false));
  }, [isTour, isScheduled, restaurantId, restaurant, orderType]);

  // Fetch batch fulfillment config when the restaurant uses batch mode
  useEffect(() => {
    if (!restaurant?.batchFulfillmentEnabled || !restaurantId) return;
    fetchBatchFulfillmentConfig(restaurantId)
      .then(setBatchConfig)
      .catch(console.error);
  }, [restaurant?.batchFulfillmentEnabled, restaurantId]);

  // Delivery zone check: fires after address is entered/geocoded, debounced 500ms.
  // Only runs for delivery orders. On network error, falls back to idle so the
  // server guard (not the UI) rejects truly out-of-zone orders.
  useEffect(() => {
    if (orderType !== 'delivery') { setZoneStatus('idle'); setDeliveryFee(0); setZoneMinOrder(null); return; }
    const hasCoord = !!deliveryLatLng;
    const hasText = deliveryAddress.trim() !== '' || deliveryCity.trim() !== '';
    if (!hasCoord && !hasText) { setZoneStatus('idle'); setDeliveryFee(0); setZoneMinOrder(null); return; }
    setZoneStatus('checking');
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const r = await checkDeliveryAddress({
          restaurantId,
          lat: deliveryLatLng?.lat,
          lng: deliveryLatLng?.lng,
          address: deliveryAddress || undefined,
          city: deliveryCity || undefined,
          // On a tour, the address is checked against THAT tour's zone alone:
          // the whole point of the round is that this city is out of range on
          // the ordinary site.
          tourId,
        });
        // Ignore a stale response if the address changed while this was in flight.
        if (cancelled) return;
        if (r.deliverable) {
          setZoneStatus('ok');
          setZoneReason('');
          // Apply the matched zone's fee and minimum. min_order null => global minimum.
          setDeliveryFee(r.delivery_fee ?? 0);
          setZoneMinOrder(r.min_order ?? null);
        } else {
          setZoneStatus('blocked');
          setZoneReason(r.reason);
          setDeliveryFee(0);
          setZoneMinOrder(null);
        }
      } catch {
        // Network/API error: do not hard-block — server guard still rejects out-of-zone orders.
        if (cancelled) return;
        setZoneStatus('idle');
        setDeliveryFee(0);
        setZoneMinOrder(null);
      }
    }, 500);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [orderType, deliveryLatLng, deliveryAddress, deliveryCity, restaurantId, tourId]);

  // Fetch delivery cities when order type is delivery. On a tour, only the
  // tour's own cities are deliverable.
  useEffect(() => {
    if (orderType !== 'delivery' || !restaurantId) return;
    let active = true;
    fetchDeliveryCities(restaurantId, tourId)
      .then((c) => { if (active) setDeliveryCities(c); })
      .catch(() => {});
    return () => { active = false; };
  }, [orderType, restaurantId, tourId]);

  // Send OTP mutation
  const sendOtpMutation = useMutation({
    mutationFn: async () => {
      return sendOTP(normalizePhone(customerPhone), Number(restaurantId));
    },
    onSuccess: (data) => {
      setOtpExpiry(data.expires_in);
      setCountdown(60); // Can resend after 60 seconds
      setStep("verify");
      setOtpError("");
    },
    onError: (error: any) => {
      setOtpError(error.message || "Failed to send code");
    },
  });

  // Verify OTP mutation
  const verifyOtpMutation = useMutation({
    mutationFn: async () => {
      return verifyOTP(normalizePhone(customerPhone), otpCode, Number(restaurantId));
    },
    onSuccess: async (data) => {
      if (data.verified) {
        setPhoneVerified(true);
        setStep("confirm");
        setOtpError("");
        // Persist session so future checkouts skip OTP
        setGuestVerified(restaurantId, normalizePhone(customerPhone));
        // Check if this customer is trusted (can pay cash)
        if (orderType === "pickup" || orderType === "delivery") {
          try {
            const trusted = await checkTrustedCustomer(restaurantId, normalizePhone(customerPhone));
            setIsTrustedCustomer(trusted);
          } catch {
            // Silently ignore — default to card
          }
        }
      } else {
        setOtpError(data.error || t("invalidCode"));
      }
    },
    onError: (error: any) => {
      setOtpError(error.message || t("invalidCode"));
    },
  });

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      // Re-fetch restaurant to get fresh rush mode / opening hours state
      const freshRestaurant = restaurantId
        ? await fetchRestaurant(restaurantId)
        : restaurant;

      if (freshRestaurant) {
        // Update local state so the UI reflects fresh data
        setRestaurant(freshRestaurant);

        if (freshRestaurant.rushMode || freshRestaurant.ordersPaused) {
          throw new Error(
            `Sorry, ${freshRestaurant.name} is temporarily paused and not accepting new orders right now.`
          );
        }

        // Skip real-time availability check for tour, scheduled and batch fulfillment
        // orders — they are fulfilled on a future day, not on today's opening hours.
        if (!futureFulfillment && !freshRestaurant.batchFulfillmentEnabled) {
          const availability = checkAvailability(
            freshRestaurant.openingHoursConfig,
            orderType,
            freshRestaurant.timezone || "UTC"
          );

          if (!availability.isOpen) {
            throw new Error(
              `Sorry, ${freshRestaurant.name} is currently closed for ${orderType}. ${availability.message || ""}`
            );
          }
        }
      }

      // When the owner's checkout form splits the name into Prénom + Nom, the
      // first-name field is prepended so the order carries one composed
      // customer_name ("Prénom Nom"). Falls back to customerName untouched for
      // single-field and legacy flows.
      const composedCustomerName =
        [customerFirstName, customerName].map((s) => s.trim()).filter(Boolean).join(" ") ||
        customerName;

      const { guestId, guestName } = useTableSession.getState();
      // A tour that requires prepayment leaves nothing to arbitrate: the round is
      // bought before it leaves, cash on delivery included. Otherwise: dine-in =
      // pay later; batch fulfillment without prepayment = pay later; everything
      // else (pickup, delivery, counter, scheduled) = pay before.
      //
      // A tour is NOT the restaurant's batch, so it does not inherit the batch's
      // pay-later exception either: the round is a delivery order and is paid for
      // like one, unless the guest is trusted enough to pay cash at the door.
      const requiresPrepayment = tourRequiresPrepayment
        ? true
        : orderType === "dine_in"
          ? false
          : paymentChoice === "cash"
            ? false
            : paymentChoice === "cibus"
              ? false // Cibus is charged directly after order creation, not via a hosted page
              : !isTour && restaurant?.batchFulfillmentEnabled && batchConfig?.requirePrepayment === false
                ? false
                : true;
      const payload: OrderPayload = {
        restaurantId,
        tableId,
        sessionId,
        guestId: guestId || undefined,
        guestName: guestName || undefined,
        orderType,
        customerName: composedCustomerName,
        customerPhone: normalizePhone(customerPhone),
        customerEmail: customerEmail.trim() || undefined,
        customerLocale: locale,
        deliveryAddress: orderType === "delivery" ? deliveryAddress : undefined,
        deliveryCity: orderType === "delivery" ? deliveryCity : undefined,
        deliveryFloor: orderType === "delivery" ? deliveryFloor : undefined,
        deliveryApt: orderType === "delivery" ? deliveryApt || undefined : undefined,
        deliveryEntryCode: orderType === "delivery" ? deliveryEntryCode || undefined : undefined,
        deliveryLatitude: orderType === "delivery" ? deliveryLatLng?.lat : undefined,
        deliveryLongitude: orderType === "delivery" ? deliveryLatLng?.lng : undefined,
        // The "notes" field on the order takes whichever notes the customer
        // supplied — pickup uses pickup_notes, delivery uses delivery_notes.
        deliveryNotes: orderType === "delivery"
          ? (deliveryNotes || undefined)
          : orderType === "pickup"
            ? (pickupNotes || undefined)
            : undefined,
        customFields: Object.keys(customFieldValues).length > 0
          ? Object.fromEntries(Object.entries(customFieldValues).filter(([, v]) => v !== "" && v !== false))
          : undefined,
        tourId,
        // The tour's delivery date IS the fulfillment date. The server re-resolves
        // it from the tour and ignores anything else the client sends; keeping the
        // payload honest is what makes the confirmation screen show the right day.
        // An immediate ("Disponible maintenant") cart is same-day: send no
        // scheduling fields so the server classifies it as immediate, not batch.
        isScheduled: cartIsImmediate ? undefined : (isTour ? true : (isScheduled || undefined)),
        scheduledFor: cartIsImmediate ? undefined : (isTour ? tour?.deliveryDate : (isScheduled && scheduledFor ? scheduledFor : undefined)),
        scheduledPickupWindowStart: cartIsImmediate ? undefined : (isTour ? tour?.deliveryStart : (isScheduled && selectedSlot ? selectedSlot.start : undefined)),
        scheduledPickupWindowEnd: cartIsImmediate ? undefined : (isTour ? tour?.deliveryEnd : (isScheduled && selectedSlot ? selectedSlot.end : undefined)),
        items: lines.filter((l) => !l.comboId).map((line) => ({
          itemId: line.item.id,
          quantity: line.quantity,
          note: line.note,
          selectedVariantId: line.selectedVariantId,
          modifiers: line.modifiers?.map((modifier) => ({
            modifierId: modifier.id,
            applied: true,
            operator: modifier.operator,
          })),
        })),
        // A "Combo ×N" batch line carries `comboOrderBatch` (N per-combo
        // selection arrays); expand it into N combo entries. Single (×1) combos
        // have no batch, so fall back to the line's own selections (one entry).
        combos: lines.filter((l) => l.comboId && l.comboSelections).flatMap((line) =>
          (line.comboOrderBatch ?? [line.comboSelections!]).map((perCombo) => ({
            comboItemId: line.comboId!,
            selections: perCombo.map((sel) => ({
              stepId: sel.stepId,
              menuItemId: sel.menuItemId,
              optionId: sel.optionId || undefined,
              quantity: sel.quantity,
              notes: sel.notes,
            })),
          })),
        ),
        paymentMethod: paymentChoice === "cibus" ? "cibus" : requiresPrepayment ? "pay_now" : paymentChoice === "cash" ? "cash" : "pay_later",
        paymentRequired: requiresPrepayment ? true : false,
      };
      return createOrder(payload);
    },
    onSuccess: async (data) => {
      setOrderPlaced(true);
      clear();

      // Refresh table session so other guests see the new order
      if (orderType === "dine_in" && sessionId) {
        useTableSession.getState().refreshOrders();
      }
      
      // Cibus (Pluxee): charge the guest's card synchronously now that the order
      // exists. all-or-nothing (require_full) — a partial charge is reversed
      // server-side, so on failure the order is simply unpaid and the guest can
      // complete payment by card on the confirmation page.
      if (paymentChoice === "cibus") {
        const slug = restaurant?.slug || restaurantId;
        try {
          const result = await chargeCibus(String(data.orderId), restaurantId, cibusCardCode.trim());
          if (result.fullyPaid) {
            router.push(`/r/${slug}/payment/success?orderId=${data.orderId}`);
            return;
          }
        } catch {
          // fall through to the confirmation page so the guest can pay by card
        }
        const qs = `?restaurantId=${restaurantId}${tableId ? `&tableId=${tableId}` : ""}${sessionId ? `&sessionId=${sessionId}` : ""}`;
        router.push(`/order/confirmation/${data.orderId}${qs}`);
        return;
      }

      // If payment URL is provided, redirect to PayPlus
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else if (orderType === "dine_in" && tableId && restaurant) {
        // Dine-in without prepayment: go back to the table page
        const slug = restaurant.slug || restaurantId;
        const tableUrl = `/r/${slug}/table/${tableId}${sessionId ? `?sessionId=${sessionId}` : ""}`;
        router.push(tableUrl);
      } else {
        // Pickup/delivery: go to the post-order confirmation page (which
        // routes to the live tracker via its track_order button).
        const qs = `?restaurantId=${restaurantId}${tableId ? `&tableId=${tableId}` : ""}${sessionId ? `&sessionId=${sessionId}` : ""}`;
        router.push(`/order/confirmation/${data.orderId}${qs}`);
      }
    },
    onError: () => {
      // A rejection here is usually the server availability guard catching an item
      // that sold out between our last check and submit. Re-fetch so the proactive
      // per-line UI lights up and the customer can fix the offending line.
      refetchAvailability();
    },
  });

  // A tour order can be refused for reasons the customer can act on, and the
  // server states them as codes. `tour_closed` is the one that really happens:
  // the round shut while the form was being filled in, and the customer is owed
  // that sentence rather than a raw error string.
  const createOrderErrorMessage = (() => {
    if (!createOrderMutation.isError) return "";
    const raw = (createOrderMutation.error as Error | null)?.message ?? "";
    switch (raw) {
      case "tour_not_found":
        return t("tourUnavailable");
      case "tour_closed":
        return t("tourOrderClosed");
      case "tour_address_outside_zone":
        return t("tourAddressOutside");
      case "tour_address_unresolved":
        return t("deliveryRefineAddress");
      case "tour_item_mismatch":
        return t("tourItemMismatch");
      default:
        return raw || t("failedToCreateOrder");
    }
  })();

  // Per-restaurant override: when the restaurant has chosen to skip phone-validation codes,
  // we bypass the verify step entirely and treat the phone as optional (notifications only).
  const otpSkipMode = restaurant?.otpMode === "skip";

  // Checkout-form builder: when the restaurant has materialised a config for
  // the current order type, render fields from that config and respect its
  // require_auth flag. Otherwise null → legacy hard-coded flow runs unchanged.
  // In preview mode the parent's posted config wins so the owner sees their
  // draft live without publishing.
  const checkoutForm = useMemo(() => {
    if (previewMode && previewConfig) {
      if (orderType === "delivery") return previewConfig.delivery ?? null;
      if (orderType === "pickup") return previewConfig.pickup ?? null;
      return null;
    }
    return resolveCheckoutForm(restaurant, orderType);
  }, [previewMode, previewConfig, restaurant, orderType]);
  const effectivePlacesKey = previewMode ? previewPlacesKey : (restaurant?.googlePlacesApiKey || "");

  // OTP is required for delivery/pickup unless the form turned it off OR the
  // restaurant-level otpSkipMode is on (legacy override kept for back-compat).
  const otpRequired = checkoutForm
    ? checkoutForm.require_auth && !otpSkipMode
    : !otpSkipMode;

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Preview iframe — no backend calls, just keep the form open for editing.
    if (previewMode) return;
    // Require date + slot when scheduling is enabled
    if (isScheduled && (!scheduledFor || !selectedSlot)) return;
    // For dine-in, skip OTP (no phone needed)
    if (orderType === "dine_in") {
      setPhoneVerified(true);
      setStep("confirm");
      return;
    }
    // Restaurant disabled OTP (either via the global setting or the per-form
    // builder flag) — go straight to confirm. Phone is optional and only used
    // for notifications if provided.
    if (!otpRequired) {
      setPhoneVerified(true);
      // Even without OTP we must still check whether this phone is a trusted
      // (cash-allowed) customer — otherwise the cash payment option would never
      // appear when OTP is turned off for pickup/delivery.
      if ((orderType === "pickup" || orderType === "delivery") && customerPhone.trim()) {
        checkTrustedCustomer(restaurantId, normalizePhone(customerPhone))
          .then(setIsTrustedCustomer)
          .catch(() => {});
      }
      setStep("confirm");
      return;
    }
    // Send OTP for pickup/delivery
    sendOtpMutation.mutate();
  };

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyOtpMutation.mutate();
  };

  const cibusNeedsCode = paymentChoice === "cibus" && !cibusCardCode.trim();

  const handleConfirmOrder = () => {
    if (cibusNeedsCode) return;
    createOrderMutation.mutate();
  };

  // Push the new order type + scheduling intent into the URL searchParams
  // AND into local scheduling state, so existing useEffects keyed on
  // `orderType` (scheduling config, checkout form, batch config, min-order
  // banner) re-run, and a page refresh preserves the selection.
  const handleOrderDetailsConfirm = (
    newOrderType: OrderType,
    intent: SchedulingIntent | null
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("orderType", newOrderType);
    if (intent) {
      params.set("isScheduled", "true");
      params.set("scheduledFor", intent.scheduledFor);
      params.set("scheduledPickupWindowStart", intent.selectedSlot.start);
      params.set("scheduledPickupWindowEnd", intent.selectedSlot.end);
    } else {
      params.delete("isScheduled");
      params.delete("scheduledFor");
      params.delete("scheduledPickupWindowStart");
      params.delete("scheduledPickupWindowEnd");
    }
    router.replace(`/order/checkout?${params.toString()}`);
    setIsScheduled(!!intent);
    setScheduledFor(intent?.scheduledFor ?? null);
    setSelectedSlot(intent?.selectedSlot ?? null);
    setOrderDetailsOpen(false);
  };

  const orderTypeLabel = {
    dine_in: t("dineIn"),
    pickup: t("pickup"),
    delivery: t("delivery"),
  }[orderType];

  const orderTypeIcon = {
    dine_in: "🍽️",
    pickup: "🛍️",
    delivery: "🚗",
  }[orderType];

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-ink-muted">Loading...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--bg-page)] pb-8" dir={direction}>
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[var(--surface)] border-b border-[var(--divider)] px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/r/${restaurant?.slug || restaurantId}${orderType === 'dine_in' && tableId ? `/table/${tableId}` : ''}`}
              className="text-[var(--text-muted)] hover:text-[var(--text)] transition"
            >
              ← {t("back")}
            </Link>
          </div>
          <h1 className="text-lg font-bold">{t("checkout")}</h1>
          <LanguageToggle />
        </div>
      </header>

      {/* Progress Steps */}
      <div className="max-w-lg mx-auto px-4 py-4">
        {(() => {
          const isDineIn = orderType === "dine_in";
          const steps: CheckoutStep[] = isDineIn
            ? ["confirm"]
            : ["details", "verify", "confirm"];
          const currentIdx = steps.indexOf(step);
          return (
            <div className="flex items-center justify-center gap-2 text-sm">
              {steps.map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition ${
                      step === s
                        ? "bg-brand text-white"
                        : i < currentIdx
                        ? "bg-green-500 text-white"
                        : "bg-[var(--surface-subtle)] text-[var(--text-muted)]"
                    }`}
                  >
                    {i < currentIdx ? "✓" : i + 1}
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className={`w-8 h-0.5 transition ${
                        i < currentIdx
                          ? "bg-green-500"
                          : "bg-[var(--divider)]"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      <div className="max-w-lg mx-auto px-4">
        <AnimatePresence mode="wait">
          {/* Step 1: Customer Details */}
          {step === "details" && (
            <motion.div
              key="details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="card p-6 space-y-6">
                <div>
                  <h2 className="text-xl font-bold">{orderType === "delivery" ? t("deliveryDetails") : orderType === "dine_in" ? t("dineInDetails") : t("pickupDetails")}</h2>
                  {isTour ? (
                    /* A tour is delivery, on its own day: nothing here is a choice,
                       so nothing here is a control. */
                    <>
                      <p className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--divider)] bg-[var(--surface-subtle)] text-sm text-[var(--text)]">
                        <span aria-hidden="true" className="leading-none">🚚</span>
                        <span className="font-semibold">{tour?.name || t("tourFixedDelivery")}</span>
                      </p>
                      {tourDayLine}
                    </>
                  ) : orderType === "dine_in" ? (
                    <p className="text-sm text-[var(--text-muted)] mt-1">
                      {orderTypeIcon} {orderTypeLabel}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setOrderDetailsOpen(true)}
                      aria-label={t("changeOrderType")}
                      className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--divider)] bg-[var(--surface-subtle)] hover:border-brand/40 hover:bg-brand/5 transition-colors text-sm text-[var(--text-primary)]"
                    >
                      <span className="leading-none">{orderTypeIcon}</span>
                      <span className="font-semibold">{orderTypeLabel}</span>
                      {isScheduled && scheduledFor && selectedSlot && (
                        <span className="text-[var(--text-muted)] font-normal">
                          · {formatDateLabel(scheduledFor, locale)} · {selectedSlot.start}
                        </span>
                      )}
                      <svg className="w-3 h-3 rtl:rotate-180 opacity-60" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Optional: sign in to autofill details + see past orders */}
                {!guestAccount && orderType !== "dine_in" && (
                  <div className="rounded-xl border border-[var(--divider)] bg-[var(--surface-subtle)] p-3 flex flex-col items-center gap-2 text-center">
                    <p className="text-sm text-[var(--text-muted)]">
                      {t("checkoutSignInPrompt") || "Sign in to save time — we'll fill in your details."}
                    </p>
                    <GoogleSignIn />
                  </div>
                )}

                <form onSubmit={handleDetailsSubmit} className="space-y-4">
                  {checkoutForm ? (
                    <CheckoutBuilderFields
                      form={checkoutForm}
                      googlePlacesApiKey={effectivePlacesKey || undefined}
                      cityOptions={deliveryCities}
                      state={{
                        customerFirstName,
                        customerName,
                        customerPhone,
                        deliveryAddress,
                        deliveryCity,
                        deliveryFloor,
                        deliveryApt,
                        deliveryEntryCode,
                        deliveryNotes,
                        pickupNotes,
                        customFields: customFieldValues,
                      }}
                      onBuiltinChange={(id, v) => {
                        switch (id) {
                          case "customer_first_name": setCustomerFirstName(v); break;
                          case "customer_name":    setCustomerName(v); break;
                          case "customer_phone":   setCustomerPhone(v); break;
                          case "delivery_address": setDeliveryAddress(v); break;
                          case "delivery_city":    setDeliveryCity(v); break;
                          case "delivery_floor":   setDeliveryFloor(v); break;
                          case "delivery_apt":     setDeliveryApt(v); break;
                          case "delivery_entry_code": setDeliveryEntryCode(v); break;
                          case "delivery_notes":   setDeliveryNotes(v); break;
                          case "pickup_notes":     setPickupNotes(v); break;
                        }
                      }}
                      onCustomChange={(id, v) => setCustomFieldValues((prev) => ({ ...prev, [id]: v }))}
                      onAddressGeocoded={(lat, lng) => setDeliveryLatLng({ lat, lng })}
                      renderAfterField={(id) => (id === "delivery_city" ? deliveryFeeNotice : null)}
                      countrySelect={(
                        <select
                          value={countryCode}
                          onChange={(e) => setCountryCode(e.target.value)}
                          className="px-3 py-3 border border-[var(--divider)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-[var(--surface)] text-[var(--text)] text-sm min-w-[100px]"
                        >
                          {COUNTRY_CODES.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.flag} {c.code}
                            </option>
                          ))}
                        </select>
                      )}
                    />
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                          {t("name")} *
                        </label>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          required
                          className="w-full px-4 py-3 border border-[var(--divider)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-[var(--surface)] text-[var(--text)]"
                          placeholder={t("yourName")}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                          {t("phone")} {orderType !== "dine_in" && !otpSkipMode && "*"}
                        </label>
                        <div className="flex gap-2" dir="ltr">
                          <select
                            value={countryCode}
                            onChange={(e) => setCountryCode(e.target.value)}
                            className="px-3 py-3 border border-[var(--divider)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-[var(--surface)] text-[var(--text)] text-sm min-w-[100px]"
                          >
                            {COUNTRY_CODES.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.flag} {c.code}
                              </option>
                            ))}
                          </select>
                          <input
                            type="tel"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            required={orderType !== "dine_in" && !otpSkipMode}
                            className="flex-1 px-4 py-3 border border-[var(--divider)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-[var(--surface)] text-[var(--text)]"
                            placeholder="50-123-4567"
                          />
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-1">
                          {orderType === "dine_in" || otpSkipMode ? t("phoneOptional") : t("verifyPhoneDescription")}
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                          {t("email")}
                        </label>
                        <input
                          type="email"
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                          className="w-full px-4 py-3 border border-[var(--divider)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-[var(--surface)] text-[var(--text)]"
                          placeholder="you@example.com"
                          dir="ltr"
                        />
                        <p className="text-xs text-[var(--text-muted)] mt-1">{t("emailOptional")}</p>
                      </div>

                      {orderType === "delivery" && (
                        <>
                          {/* City comes first — it gates the rest of the address
                              fields. The address, floor and notes only appear once
                              the customer has picked a city. */}
                          <div>
                            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                              {t("deliveryCity")} *
                            </label>
                            {deliveryCities.length > 0 ? (
                              <select
                                value={deliveryCity}
                                onChange={(e) => setDeliveryCity(e.target.value)}
                                required
                                className="w-full px-4 py-3 border border-[var(--divider)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-[var(--surface)] text-[var(--text)]"
                              >
                                <option value="" disabled>{t("chooseCity") || "Choisir une ville"}</option>
                                {deliveryCities.map((city) => (
                                  <option key={city} value={city}>{city}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={deliveryCity}
                                onChange={(e) => setDeliveryCity(e.target.value)}
                                required
                                className="w-full px-4 py-3 border border-[var(--divider)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-[var(--surface)] text-[var(--text)]"
                                placeholder={t("cityPlaceholder")}
                              />
                            )}
                          </div>

                          {/* Fee shown right after the city, before the address fields. */}
                          {deliveryFeeNotice}

                          {deliveryCity.trim() && (
                            <>
                              <div>
                                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                                  {t("deliveryAddress")} *
                                </label>
                                <textarea
                                  value={deliveryAddress}
                                  onChange={(e) => setDeliveryAddress(e.target.value)}
                                  required
                                  rows={2}
                                  className="w-full px-4 py-3 border border-[var(--divider)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-[var(--surface)] text-[var(--text)] resize-none"
                                  placeholder={t("fullAddress")}
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                                  {t("deliveryFloor")}
                                </label>
                                <input
                                  type="text"
                                  value={deliveryFloor}
                                  onChange={(e) => setDeliveryFloor(e.target.value)}
                                  className="w-full px-4 py-3 border border-[var(--divider)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-[var(--surface)] text-[var(--text)]"
                                  placeholder={t("floorPlaceholder")}
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                                  {t("deliveryEntryCode")}
                                </label>
                                <input
                                  type="text"
                                  value={deliveryEntryCode}
                                  onChange={(e) => setDeliveryEntryCode(e.target.value)}
                                  className="w-full px-4 py-3 border border-[var(--divider)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-[var(--surface)] text-[var(--text)]"
                                  placeholder={t("entryCodePlaceholder")}
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                                  {t("deliveryNotes")}
                                </label>
                                <input
                                  type="text"
                                  value={deliveryNotes}
                                  onChange={(e) => setDeliveryNotes(e.target.value)}
                                  className="w-full px-4 py-3 border border-[var(--divider)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-[var(--surface)] text-[var(--text)]"
                                  placeholder={t("deliveryNotesPlaceholder")}
                                />
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </>
                  )}

                  {/* Batch fulfillment summary — at checkout we want the full
                      detail (date + window + cutoff) since the customer is
                      about to commit. The menu page handles awareness via the
                      hero pill; this block is the per-order confirmation. */}
                  {!isTour && (orderType === "pickup" || orderType === "delivery") && restaurant?.batchFulfillmentEnabled && batchConfig?.enabled && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                      {cartIsImmediate ? (
                        <p className="text-sm font-semibold text-amber-800">
                          {t("immediatePickupToday")}
                        </p>
                      ) : batchConfig.orderingOpen ? (
                        <>
                          <p className="text-sm font-semibold text-amber-800">
                            {orderType === "delivery" ? t("batchDeliveryInfo") : t("batchPickupInfo")}
                          </p>
                          {batchConfig.fulfillmentDays
                            .filter((day) => (scheduledFor ? day.date === scheduledFor : true))
                            .map((day) => {
                            const window = orderType === "delivery" ? day.deliveryWindow : day.pickupWindow;
                            if (!window) return null;
                            return (
                              <p key={day.date} className="text-sm text-amber-700">
                                {orderType === "delivery" ? t("batchOrderDeliveredOn") : t("batchOrderReadyOn")}{" "}
                                <span className="font-semibold">{formatWeekday(day.date, locale)}, {formatDateLabel(day.date, locale)}</span>{" "}
                                {t("batchBetween")} <span className="font-semibold">{window.start} – {window.end}</span>
                              </p>
                            );
                          })}
                          <p className="text-xs text-amber-600">
                            {t("batchOrderingCloses")}{" "}
                            {(() => {
                              const m = batchConfig.currentBatchCutoff.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
                              if (m) {
                                const dayName = formatWeekday(`${m[1]}-${m[2]}-${m[3]}`, locale);
                                const time = batchConfig.cutoffTime || `${m[4]}:${m[5]}`;
                                return `${dayName} ${t("batchOrderingClosesAt")} ${time}`;
                              }
                              return batchConfig.cutoffDayName
                                ? `${batchConfig.cutoffDayName} ${t("batchOrderingClosesAt")} ${batchConfig.cutoffTime}`
                                : "";
                            })()}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-amber-700">
                          {t("batchOrderingClosed")}
                          {cartMixed ? " " + t("immediateMixedHint") : ""}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Scheduling — pickup and delivery, when restaurant enables it (not in
                      batch mode, and never on a tour: the round's day is the day). */}
                  {!isTour && (orderType === "pickup" || orderType === "delivery") && restaurant?.schedulingEnabled && !restaurant?.batchFulfillmentEnabled && (
                    isScheduled && scheduledFor && selectedSlot ? (
                      /* Read-only summary — schedule was chosen (from URL or inline) */
                      <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <span className="text-xl">📅</span>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-amber-800">Scheduled {orderType === "delivery" ? "delivery" : "pickup"}</p>
                          <p className="text-sm text-amber-700">
                            {formatDateLabel(scheduledFor, locale)} · {selectedSlot.start} – {selectedSlot.end}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsScheduled(false);
                            setScheduledFor(null);
                            setSelectedSlot(null);
                            setSchedulingConfig(null);
                          }}
                          className="text-xs text-amber-600 hover:text-amber-800 underline flex-shrink-0"
                        >
                          {t("change") || "Change"}
                        </button>
                      </div>
                    ) : (
                      /* Inline toggle+picker when NOT pre-filled from URL */
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 bg-[var(--surface-subtle)] rounded-xl">
                          <div>
                            <p className="font-medium text-sm">Schedule for later</p>
                            <p className="text-xs text-[var(--text-muted)]">Pick a future date &amp; time slot</p>
                          </div>
                          <button
                            type="button"
                            aria-pressed={isScheduled}
                            onClick={() => {
                              setIsScheduled((v) => !v);
                              setScheduledFor(null);
                              setSelectedSlot(null);
                              setSchedulingConfig(null);
                            }}
                            className={`relative w-12 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand ${
                              isScheduled ? "bg-brand" : "bg-[var(--divider)]"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                                isScheduled ? "translate-x-6" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>

                        {isScheduled && (
                          <div className="space-y-4">
                            {schedulingLoading ? (
                              <p className="text-center text-sm text-[var(--text-muted)] py-4">
                                Loading available dates…
                              </p>
                            ) : schedulingConfig && Object.keys(schedulingConfig.slotsByDate).length > 0 ? (
                              <>
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">
                                    Select date
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {Object.keys(schedulingConfig.slotsByDate).sort().map((date) => (
                                      <button
                                        type="button"
                                        key={date}
                                        onClick={() => { setScheduledFor(date); setSelectedSlot(null); }}
                                        className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${
                                          scheduledFor === date
                                            ? "bg-brand text-white border-brand"
                                            : "bg-[var(--surface)] border-[var(--divider)] text-[var(--text)] hover:border-brand"
                                        }`}
                                      >
                                        {formatDateLabel(date, locale)}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                {scheduledFor && (
                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">
                                      Select time
                                    </p>
                                    {(schedulingConfig.slotsByDate[scheduledFor] ?? []).length === 0 ? (
                                      <p className="text-sm text-[var(--text-muted)]">No slots available for this day.</p>
                                    ) : (
                                      <div className="flex flex-wrap gap-2">
                                        {(schedulingConfig.slotsByDate[scheduledFor] ?? []).map((slot) => (
                                          <button
                                            type="button"
                                            key={slot.start}
                                            onClick={() => setSelectedSlot(slot)}
                                            className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${
                                              selectedSlot?.start === slot.start
                                                ? "bg-brand text-white border-brand"
                                                : "bg-[var(--surface)] border-[var(--divider)] text-[var(--text)] hover:border-brand"
                                            }`}
                                          >
                                            {slot.start} – {slot.end}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {isScheduled && (!scheduledFor || !selectedSlot) && (
                                  <p className="text-xs text-amber-600">
                                    Please select a date and time slot to continue.
                                  </p>
                                )}
                              </>
                            ) : schedulingConfig ? (
                              <p className="text-sm text-[var(--text-muted)] text-center py-4">
                                No available slots in the booking window. Try ordering for now.
                              </p>
                            ) : null}
                          </div>
                        )}
                      </div>
                    )
                  )}

                  {tourExpiredNotice}

                  <button
                    type="submit"
                    disabled={
                      sendOtpMutation.isPending ||
                      tourExpired ||
                      cartMixed ||
                      (isScheduled && (!scheduledFor || !selectedSlot)) ||
                      // The batch cutoff blocks pre-order carts, but an all-immediate
                      // ("Disponible maintenant") cart is sold same-day past the cutoff.
                      (!isTour && !cartIsImmediate && restaurant?.batchFulfillmentEnabled && batchConfig?.enabled && !batchConfig.orderingOpen)
                    }
                    className="w-full py-4 rounded-xl bg-brand text-white font-bold shadow-lg shadow-brand/30 hover:bg-brand-dark transition disabled:opacity-50"
                  >
                    {sendOtpMutation.isPending ? "..." : t("continue")}
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {/* Step 2: Phone Verification */}
          {step === "verify" && (
            <motion.div
              key="verify"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="card p-6 space-y-6">
                <div>
                  <h2 className="text-xl font-bold">{t("verifyPhone")}</h2>
                  <p className="text-sm text-[var(--text-muted)] mt-1">
                    {t("codeSent")} <span className="font-mono font-bold">{customerPhone}</span>
                  </p>
                </div>

                <form onSubmit={handleVerifySubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                      {t("enterCode")}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      className="w-full px-4 py-4 text-center text-2xl font-mono tracking-[0.5em] border border-[var(--divider)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-[var(--surface)] text-[var(--text)]"
                      placeholder="• • • • • •"
                      autoFocus
                      dir="ltr"
                    />
                  </div>

                  {otpError && (
                    <p className="text-sm text-red-500 text-center">{otpError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={otpCode.length !== 6 || verifyOtpMutation.isPending}
                    className="w-full py-4 rounded-xl bg-brand text-white font-bold shadow-lg shadow-brand/30 hover:bg-brand-dark transition disabled:opacity-50"
                  >
                    {verifyOtpMutation.isPending ? "..." : t("verifyCode")}
                  </button>

                  {skipOtpEnabled && (
                    <button
                      type="button"
                      onClick={() => {
                        setPhoneVerified(true);
                        setStep("confirm");
                        setGuestVerified(restaurantId, normalizePhone(customerPhone));
                      }}
                      className="w-full py-3 rounded-xl border-2 border-dashed border-yellow-400 text-yellow-600 font-medium text-sm hover:bg-yellow-50 transition"
                    >
                      Skip OTP (Dev)
                    </button>
                  )}

                  <div className="flex items-center justify-between text-sm">
                    <button
                      type="button"
                      onClick={() => setStep("details")}
                      className="text-[var(--text-muted)] hover:text-[var(--text)]"
                    >
                      ← {t("back")}
                    </button>
                    <button
                      type="button"
                      onClick={() => sendOtpMutation.mutate()}
                      disabled={countdown > 0 || sendOtpMutation.isPending}
                      className="text-brand hover:underline disabled:opacity-50 disabled:no-underline"
                    >
                      {countdown > 0 ? `${t("resendCode")} (${countdown}s)` : t("resendCode")}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}

          {/* Step 3: Confirm Order */}
          {step === "confirm" && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="card p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold">{t("reviewOrder")}</h2>
                  <Link
                    href={`/r/${restaurant?.slug || restaurantId}${orderType === 'dine_in' && tableId ? `/table/${tableId}` : ''}`}
                    className="text-sm text-brand hover:underline"
                  >
                    {t("editOrder")}
                  </Link>
                </div>

                {/* Order Info */}
                <div className="bg-[var(--surface-subtle)] rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span>{isTour ? "🚚" : orderTypeIcon}</span>
                    <span className="font-medium">{isTour ? (tour?.name || t("tourFixedDelivery")) : orderTypeLabel}</span>
                  </div>
                  {isTour ? (
                    tour && (
                      <div className="flex items-center gap-2 text-sm font-medium text-brand">
                        <span>📅</span>
                        <span>
                          {t("tourDeliveryOn").replace("{date}", formatDateLabel(tour.deliveryDate, locale, { lowerRelative: true }))}
                          {tour.deliveryStart && tour.deliveryEnd ? `, ${tour.deliveryStart} - ${tour.deliveryEnd}` : ""}
                        </span>
                      </div>
                    )
                  ) : restaurant?.batchFulfillmentEnabled && batchConfig?.enabled && batchConfig.fulfillmentDays.length > 0 ? (
                    <div className="flex items-center gap-2 text-sm font-medium text-brand">
                      <span>📅</span>
                      <span>
                        {batchConfig.fulfillmentDays.map((day) => {
                          const window = orderType === "delivery" ? day.deliveryWindow : day.pickupWindow;
                          const dayName = formatWeekday(day.date, locale);
                          return window ? `${dayName} ${formatDateLabel(day.date, locale)} · ${window.start} – ${window.end}` : dayName;
                        }).join(", ")}
                      </span>
                    </div>
                  ) : isScheduled && scheduledFor && selectedSlot ? (
                    <div className="flex items-center gap-2 text-sm font-medium text-brand">
                      <span>📅</span>
                      <span>
                        {formatDateLabel(scheduledFor, locale)} · {selectedSlot.start} – {selectedSlot.end}
                      </span>
                    </div>
                  ) : null}
                  <div className="text-sm text-[var(--text-muted)]">
                    <p>{customerName}</p>
                    {customerPhone && <p dir="ltr" className="font-mono">{customerPhone}</p>}
                    {orderType === "delivery" && (deliveryAddress || deliveryCity || deliveryFloor || deliveryApt || deliveryNotes) && (
                      <div className="mt-1 space-y-0.5">
                        {deliveryAddress && <p>{deliveryAddress}</p>}
                        {deliveryCity && <p>{deliveryCity}</p>}
                        {(deliveryFloor || deliveryApt) && (
                          <p>{t("deliveryFloor")}: {[deliveryFloor, deliveryApt].filter(Boolean).join(" · ")}</p>
                        )}
                        {deliveryNotes && <p className="italic">{deliveryNotes}</p>}
                      </div>
                    )}
                  </div>
                </div>

                {/* Minimum order warning for delivery */}
                {isBelowMinimum && (
                  <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <span className="text-xl">⚠️</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-800">
                        {t("minimumOrderNotMet")} {CURRENCY_SYMBOL}{minimumOrderDelivery.toFixed(2)}
                      </p>
                      <p className="text-sm text-amber-700">
                        {t("addMoreToReachMinimum")} ({CURRENCY_SYMBOL}{(minimumOrderDelivery - displayTotal).toFixed(2)})
                      </p>
                    </div>
                  </div>
                )}

                {/* Order Items */}
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {displayLines.map((line) => {
                    const status = lineAvailability.get(line.id) ?? { status: "ok" as const };
                    const blocked = status.status !== "ok";
                    return (
                    <div key={line.id} className={`flex items-start gap-3 py-2 border-b border-[var(--divider)] last:border-0${blocked ? " opacity-60" : ""}`}>
                      <div className="flex-1">
                        <p className="font-medium">
                          {tField(line.item, "name", menuLocale)}{line.selectedVariantName ? ` - ${line.selectedVariantName}` : ''}
                          {status.status === "sold_out" && (
                            <span className="ml-2 align-middle text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                              {t("soldOut")}
                            </span>
                          )}
                          {status.status === "insufficient" && (
                            <span className="ml-2 align-middle text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                              {status.available} {t("left")}
                            </span>
                          )}
                        </p>
                        {line.modifiers && line.modifiers.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {line.modifiers.map((modifier) => (
                              <span
                                key={modifier.id}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--surface-subtle)] text-[var(--text-muted)]"
                              >
                                {formatModifierLabel(modifier, menuLocale)}
                              </span>
                            ))}
                          </div>
                        )}
                        {line.note && <p className="text-xs text-[var(--text-muted)] mt-1">{line.note}</p>}
                        {status.status === "sold_out" && (
                          <button
                            type="button"
                            onClick={() => removeItem(line.id)}
                            className="mt-1 text-xs font-semibold text-red-600 hover:underline"
                          >
                            {t("remove")}
                          </button>
                        )}
                        {status.status === "insufficient" && (
                          <button
                            type="button"
                            onClick={() => updateQuantity(line.id, status.available)}
                            className="mt-1 text-xs font-semibold text-amber-700 hover:underline"
                          >
                            {t("reduceToN").replace("{n}", String(status.available))}
                          </button>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{currencyLabel} {lineTotal(line).toFixed(2)}</p>
                        <p className="text-xs text-[var(--text-muted)]">×{line.quantity}</p>
                      </div>
                    </div>
                    );
                  })}
                </div>

                {/* Total breakdown. Prices are VAT-inclusive, so we show gross
                    lines that reconcile (subtotal + delivery = total) and surface
                    the VAT contained in the total as an informational line. The
                    delivery fee is treated as VAT-inclusive, so the VAT shown is
                    computed on the whole total (items + delivery), not items alone. */}
                <div className="space-y-2 border-t border-[var(--divider)] pt-4">
                  <div className="flex justify-between text-[var(--text-muted)]">
                    <span>{t("subtotal")}</span>
                    <span>{currencyLabel} {displayTotal.toFixed(2)}</span>
                  </div>
                  {orderType === "delivery" && zoneStatus === "ok" && (
                    <div className="flex justify-between text-[var(--text-muted)]">
                      <span>{t("deliveryFee")}</span>
                      <span>{appliedDeliveryFee > 0 ? `${currencyLabel} ${appliedDeliveryFee.toFixed(2)}` : t("free")}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg border-t border-[var(--divider)] pt-2">
                    <div>
                      <p>{t("total")}</p>
                      <p className="text-sm text-[var(--text-muted)] font-normal">
                        {totalItems} {t("items")}
                      </p>
                    </div>
                    <p className="text-2xl">
                      {currencyLabel} {grandTotal.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex justify-between text-xs text-[var(--text-muted)]">
                    <span>{t("vatIncluded")} (18%)</span>
                    <span>{currencyLabel} {(grandTotal - grandTotal / VAT_MULTIPLIER).toFixed(2)}</span>
                  </div>
                </div>

                {/* By-weight acknowledgment. Some items are priced by weight, so
                    the total above is an estimate. A hold (estimate + buffer) is
                    placed and the final charge reflects the actual weight. */}
                {hasByWeightLines && (
                  <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <span className="text-xl">⚖️</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-800">{t("byWeightHoldTitle")}</p>
                      <p className="text-sm text-amber-700">{t("byWeightHoldHelp")}</p>
                    </div>
                  </div>
                )}

                {/* Payment method selector — shown for trusted customers on pickup/delivery.
                    A tour that requires prepayment takes the choice away: it is paid before
                    the round leaves. */}
                {isTrustedCustomer && orderType !== "dine_in" && !tourRequiresPrepayment && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentChoice("card")}
                      className={`flex-1 py-3 rounded-xl font-semibold text-sm border-2 transition ${
                        paymentChoice === "card"
                          ? "border-brand bg-brand/10 text-brand"
                          : "border-[var(--divider)] text-[var(--text-muted)]"
                      }`}
                    >
                      {t("creditCard") || "Credit Card"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentChoice("cash")}
                      className={`flex-1 py-3 rounded-xl font-semibold text-sm border-2 transition ${
                        paymentChoice === "cash"
                          ? "border-brand bg-brand/10 text-brand"
                          : "border-[var(--divider)] text-[var(--text-muted)]"
                      }`}
                    >
                      {t("cash") || "Cash"}
                    </button>
                  </div>
                )}

                {/* Cibus (Pluxee) — offered to every guest on pickup/delivery
                    (except tour prepayment). Toggling it on reveals the card-code
                    input; the charge happens right after the order is created. */}
                {orderType !== "dine_in" && !tourRequiresPrepayment && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPaymentChoice(paymentChoice === "cibus" ? "card" : "cibus")
                      }
                      className={`w-full py-3 rounded-xl font-semibold text-sm border-2 transition ${
                        paymentChoice === "cibus"
                          ? "border-brand bg-brand/10 text-brand"
                          : "border-[var(--divider)] text-[var(--text-muted)]"
                      }`}
                    >
                      {t("payWithCibus") || "Pay with Cibus"}
                    </button>
                    {paymentChoice === "cibus" && (
                      <input
                        type="text"
                        inputMode="numeric"
                        value={cibusCardCode}
                        onChange={(e) => setCibusCardCode(e.target.value)}
                        placeholder={t("cibusCardCodePlaceholder") || "Cibus card or app code"}
                        className="w-full px-4 py-3 rounded-xl border-2 border-[var(--divider)] bg-[var(--surface)] text-sm focus:border-brand focus:outline-none"
                      />
                    )}
                  </div>
                )}

                {orderType === 'delivery' && zoneStatus === 'blocked' && (
                  <p className="text-sm text-red-500 text-center">{zoneBlockedMessage}</p>
                )}

                {tourExpiredNotice}

                {hasBlockedLines && (
                  <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <span className="text-xl">⚠️</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-800">{t("itemsUnavailableTitle")}</p>
                      <p className="text-sm text-amber-700">{t("itemsUnavailableHelp")}</p>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleConfirmOrder}
                  disabled={createOrderMutation.isPending || checkoutBlocked || cibusNeedsCode || (orderType === 'delivery' && zoneStatus === 'blocked')}
                  className="w-full py-4 rounded-xl bg-brand text-white font-bold shadow-lg shadow-brand/30 hover:bg-brand-dark transition disabled:bg-[var(--surface-subtle)] disabled:text-[var(--text-muted)] disabled:shadow-none disabled:cursor-not-allowed"
                >
                  {createOrderMutation.isPending
                    ? "..."
                    : tourRequiresPrepayment
                    ? t("confirmAndPay")
                    : paymentChoice === "cash"
                    ? t("placeOrder") || "Place Order"
                    : isTour
                    ? t("confirmAndPay")
                    : restaurant?.batchFulfillmentEnabled && batchConfig?.requirePrepayment
                    ? t("placeOrderAndPay")
                    : restaurant?.batchFulfillmentEnabled
                    ? t("placeOrder")
                    : isScheduled && !restaurant?.schedulingRequirePrepayment
                    ? t("scheduleOrder")
                    : isScheduled
                    ? t("scheduleAndPay")
                    : orderType === "dine_in"
                    ? t("confirmAndOrder") || t("confirmOrder")
                    : t("confirmAndPay") || t("confirmOrder")}
                </button>

                {/* Availability rejections surface through the amber banner + per-line
                    actions above (onError refetches), so only show the raw message for
                    other failures (closed, paused, payment, etc.). */}
                {createOrderMutation.isError && !hasBlockedLines && !tourExpired && (
                  <p className="text-sm text-red-500 text-center">{createOrderErrorMessage}</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Order-type / scheduling editor. Never on a tour: neither is the
          customer's to change there. */}
      {restaurant && orderType !== "dine_in" && !isTour && (
        <OrderDetailsModal
          open={orderDetailsOpen}
          onClose={() => setOrderDetailsOpen(false)}
          restaurant={restaurant}
          currency={currency}
          orderType={orderType}
          initialSchedulingIntent={
            isScheduled && scheduledFor && selectedSlot
              ? { scheduledFor, selectedSlot }
              : null
          }
          cartLineSaleModes={lines.map((l) => l.item.immediateSaleMode ?? "")}
          onConfirm={handleOrderDetailsConfirm}
        />
      )}
    </main>
  );
}
