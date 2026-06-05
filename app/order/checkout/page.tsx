"use client";

import { Suspense } from "react";
import { useCartStore } from "@/store/useCartStore";
import { useI18n } from "@/lib/i18n";
import { useHydrated } from "@/hooks/useHydrated";
import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  createOrder,
  sendOTP,
  verifyOTP,
  fetchRestaurant,
  fetchSchedulingConfig,
  fetchBatchFulfillmentConfig,
  checkTrustedCustomer,
} from "@/services/api";
import { BatchFulfillmentConfigResponse, CheckoutConfig, OrderPayload, OrderType, Restaurant, SchedulingConfigResponse, SchedulingTimeSlot } from "@/lib/types";
import { formatModifierLabel, lineTotal, lineUnitPrice } from "@/lib/cart";
import { checkAvailability } from "@/lib/availability";
import { LanguageToggle } from "@/components/LanguageToggle";
import { BatchOrderingBanner } from "@/components/BatchOrderingBanner";
import CheckoutBuilderFields from "@/components/CheckoutBuilderFields";
import { OrderDetailsModal, SchedulingIntent } from "@/components/OrderDetailsModal";
import { resolveCheckoutForm } from "@/lib/checkout-fields";
import { VAT_MULTIPLIER, CURRENCY_SYMBOL } from "@/lib/constants";
import { useTableSession } from "@/store/useTableSession";
import { useGuestAuth } from "@/store/useGuestAuth";
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
  const hydrated = useHydrated();
  const skipOtpEnabled = process.env.NEXT_PUBLIC_SKIP_OTP_ENABLED === "true";

  // Extract params
  const restaurantId = searchParams.get("restaurantId") || "";
  const orderType = (searchParams.get("orderType") as OrderType) || "pickup";
  const tableId = searchParams.get("tableId") || undefined;
  const sessionId = searchParams.get("sessionId") || undefined;
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
  const clear = useCartStore((s) => s.clear);

  // Restaurant data
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);

  // Form state
  const [step, setStep] = useState<CheckoutStep>("details");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+972");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryFloor, setDeliveryFloor] = useState("");
  const [deliveryApt, setDeliveryApt] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [pickupNotes, setPickupNotes] = useState("");
  const [deliveryLatLng, setDeliveryLatLng] = useState<{ lat: number; lng: number } | null>(null);
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

  // Scheduling state — pre-filled from URL params set by the Order Details modal
  const [isScheduled, setIsScheduled] = useState(scheduledFromUrl);
  const [scheduledFor, setScheduledFor] = useState<string | null>(scheduledForFromUrl);
  const [selectedSlot, setSelectedSlot] = useState<SchedulingTimeSlot | null>(
    slotStartFromUrl && slotEndFromUrl ? { start: slotStartFromUrl, end: slotEndFromUrl } : null
  );
  const [schedulingConfig, setSchedulingConfig] = useState<SchedulingConfigResponse | null>(null);
  const [schedulingLoading, setSchedulingLoading] = useState(false);

  // Batch fulfillment state
  const [batchConfig, setBatchConfig] = useState<BatchFulfillmentConfigResponse | null>(null);

  // Trusted customer / cash payment state
  const [isTrustedCustomer, setIsTrustedCustomer] = useState(false);
  const [paymentChoice, setPaymentChoice] = useState<"card" | "cash">("card");

  // Computed values
  const displayLines = hydrated ? lines : [];
  const displayTotal = hydrated ? total() : 0;
  const totalItems = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity, 0),
    [lines]
  );

  // Minimum order check for delivery
  const minimumOrderDelivery = restaurant?.minimumOrderDelivery ?? 0;
  const isBelowMinimum = orderType === "delivery" && minimumOrderDelivery > 0 && displayTotal < minimumOrderDelivery;

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

  // Fetch scheduling config when schedule toggle is enabled
  useEffect(() => {
    if (!isScheduled || !restaurantId || !restaurant) return;
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
  }, [isScheduled, restaurantId, restaurant, orderType]);

  // Fetch batch fulfillment config when the restaurant uses batch mode
  useEffect(() => {
    if (!restaurant?.batchFulfillmentEnabled || !restaurantId) return;
    fetchBatchFulfillmentConfig(restaurantId)
      .then(setBatchConfig)
      .catch(console.error);
  }, [restaurant?.batchFulfillmentEnabled, restaurantId]);

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

        if (freshRestaurant.rushMode) {
          throw new Error(
            `Sorry, ${freshRestaurant.name} is temporarily paused and not accepting new orders right now.`
          );
        }

        // Skip real-time availability check for scheduled and batch fulfillment orders
        if (!isScheduled && !freshRestaurant.batchFulfillmentEnabled) {
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

      const { guestId, guestName } = useTableSession.getState();
      // Dine-in = pay later; batch fulfillment without prepayment = pay later;
      // everything else (pickup, delivery, counter, scheduled) = pay before
      const requiresPrepayment =
        orderType === "dine_in"
          ? false
          : paymentChoice === "cash"
            ? false
            : restaurant?.batchFulfillmentEnabled && batchConfig?.requirePrepayment === false
              ? false
              : true;
      const payload: OrderPayload = {
        restaurantId,
        tableId,
        sessionId,
        guestId: guestId || undefined,
        guestName: guestName || undefined,
        orderType,
        customerName,
        customerPhone: normalizePhone(customerPhone),
        deliveryAddress: orderType === "delivery" ? deliveryAddress : undefined,
        deliveryCity: orderType === "delivery" ? deliveryCity : undefined,
        deliveryFloor: orderType === "delivery" ? deliveryFloor : undefined,
        deliveryApt: orderType === "delivery" ? deliveryApt || undefined : undefined,
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
        isScheduled: isScheduled || undefined,
        scheduledFor: isScheduled && scheduledFor ? scheduledFor : undefined,
        scheduledPickupWindowStart: isScheduled && selectedSlot ? selectedSlot.start : undefined,
        scheduledPickupWindowEnd: isScheduled && selectedSlot ? selectedSlot.end : undefined,
        items: lines.filter((l) => !l.comboId).map((line) => ({
          itemId: line.item.id,
          quantity: line.quantity,
          note: line.note,
          selectedVariantId: line.selectedVariantId,
          modifiers: line.modifiers?.map((modifier) => ({
            modifierId: modifier.id,
            applied: true,
          })),
        })),
        combos: lines.filter((l) => l.comboId && l.comboSelections).map((line) => ({
          comboItemId: line.comboId!,
          selections: line.comboSelections!.map((sel) => ({
            stepId: sel.stepId,
            menuItemId: sel.menuItemId,
            optionId: sel.optionId || undefined,
            quantity: sel.quantity,
            notes: sel.notes,
          })),
        })),
        paymentMethod: requiresPrepayment ? "pay_now" : paymentChoice === "cash" ? "cash" : "pay_later",
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
  });

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

  const handleConfirmOrder = () => {
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
                  {orderType === "dine_in" ? (
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

                <form onSubmit={handleDetailsSubmit} className="space-y-4">
                  {checkoutForm ? (
                    <CheckoutBuilderFields
                      form={checkoutForm}
                      googlePlacesApiKey={effectivePlacesKey || undefined}
                      state={{
                        customerName,
                        customerPhone,
                        deliveryAddress,
                        deliveryCity,
                        deliveryFloor,
                        deliveryApt,
                        deliveryNotes,
                        pickupNotes,
                        customFields: customFieldValues,
                      }}
                      onBuiltinChange={(id, v) => {
                        switch (id) {
                          case "customer_name":    setCustomerName(v); break;
                          case "customer_phone":   setCustomerPhone(v); break;
                          case "delivery_address": setDeliveryAddress(v); break;
                          case "delivery_city":    setDeliveryCity(v); break;
                          case "delivery_floor":   setDeliveryFloor(v); break;
                          case "delivery_apt":     setDeliveryApt(v); break;
                          case "delivery_notes":   setDeliveryNotes(v); break;
                          case "pickup_notes":     setPickupNotes(v); break;
                        }
                      }}
                      onCustomChange={(id, v) => setCustomFieldValues((prev) => ({ ...prev, [id]: v }))}
                      onAddressGeocoded={(lat, lng) => setDeliveryLatLng({ lat, lng })}
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

                      {orderType === "delivery" && (
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
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                                {t("deliveryCity")} *
                              </label>
                              <input
                                type="text"
                                value={deliveryCity}
                                onChange={(e) => setDeliveryCity(e.target.value)}
                                required
                                className="w-full px-4 py-3 border border-[var(--divider)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-[var(--surface)] text-[var(--text)]"
                                placeholder={t("cityPlaceholder")}
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

                  {/* Batch fulfillment banner — same component as on the menu
                      page so customers see consistent messaging. Renders null
                      when batch mode is off or for dine-in. */}
                  {(orderType === "pickup" || orderType === "delivery") && (
                    <BatchOrderingBanner config={batchConfig} orderType={orderType} />
                  )}

                  {/* Scheduling — pickup and delivery, when restaurant enables it (not in batch mode) */}
                  {(orderType === "pickup" || orderType === "delivery") && restaurant?.schedulingEnabled && !restaurant?.batchFulfillmentEnabled && (
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

                  <button
                    type="submit"
                    disabled={
                      sendOtpMutation.isPending ||
                      (isScheduled && (!scheduledFor || !selectedSlot)) ||
                      (restaurant?.batchFulfillmentEnabled && batchConfig?.enabled && !batchConfig.orderingOpen)
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
                    <span>{orderTypeIcon}</span>
                    <span className="font-medium">{orderTypeLabel}</span>
                  </div>
                  {restaurant?.batchFulfillmentEnabled && batchConfig?.enabled && batchConfig.fulfillmentDays.length > 0 ? (
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
                    {orderType === "delivery" && deliveryAddress && (
                      <p className="mt-1">{deliveryAddress}</p>
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
                  {displayLines.map((line) => (
                    <div key={line.id} className="flex items-start gap-3 py-2 border-b border-[var(--divider)] last:border-0">
                      <div className="flex-1">
                        <p className="font-medium">
                          {line.item.name}{line.selectedVariantName ? ` - ${line.selectedVariantName}` : ''}
                        </p>
                        {line.modifiers && line.modifiers.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {line.modifiers.map((modifier) => (
                              <span
                                key={modifier.id}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--surface-subtle)] text-[var(--text-muted)]"
                              >
                                {formatModifierLabel(modifier)}
                              </span>
                            ))}
                          </div>
                        )}
                        {line.note && <p className="text-xs text-[var(--text-muted)] mt-1">{line.note}</p>}
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{currency} {lineTotal(line).toFixed(2)}</p>
                        <p className="text-xs text-[var(--text-muted)]">×{line.quantity}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total with VAT Breakdown */}
                <div className="space-y-2 border-t border-[var(--divider)] pt-4">
                  <div className="flex justify-between text-[var(--text-muted)]">
                    <span>{t("subtotal")}</span>
                    <span>{currency} {(displayTotal / VAT_MULTIPLIER).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[var(--text-muted)]">
                    <span>{t("vat")} (18%)</span>
                    <span>{currency} {(displayTotal - displayTotal / VAT_MULTIPLIER).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t border-[var(--divider)] pt-2">
                    <div>
                      <p>{t("total")}</p>
                      <p className="text-sm text-[var(--text-muted)] font-normal">
                        {totalItems} {t("items")}
                      </p>
                    </div>
                    <p className="text-2xl">
                      {currency} {displayTotal.toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Payment method selector — shown for trusted customers on pickup/delivery */}
                {isTrustedCustomer && orderType !== "dine_in" && (
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

                <button
                  type="button"
                  onClick={handleConfirmOrder}
                  disabled={createOrderMutation.isPending || isBelowMinimum}
                  className="w-full py-4 rounded-xl bg-brand text-white font-bold shadow-lg shadow-brand/30 hover:bg-brand-dark transition disabled:opacity-50"
                >
                  {createOrderMutation.isPending
                    ? "..."
                    : paymentChoice === "cash"
                    ? t("placeOrder") || "Place Order"
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

                {createOrderMutation.isError && (
                  <p className="text-sm text-red-500 text-center">
                    {(createOrderMutation.error as any)?.message || t("failedToCreateOrder")}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {restaurant && orderType !== "dine_in" && (
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
          onConfirm={handleOrderDetailsConfirm}
        />
      )}
    </main>
  );
}
