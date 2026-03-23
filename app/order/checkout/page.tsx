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
} from "@/services/api";
import { BatchFulfillmentConfigResponse, OrderPayload, OrderType, Restaurant, SchedulingConfigResponse, SchedulingTimeSlot } from "@/lib/types";
import { formatModifierLabel, lineTotal, lineUnitPrice } from "@/lib/cart";
import { checkAvailability } from "@/lib/availability";
import { LanguageToggle } from "@/components/LanguageToggle";
import { VAT_MULTIPLIER, CURRENCY_SYMBOL } from "@/lib/constants";
import { useTableSession } from "@/store/useTableSession";
import { useGuestAuth } from "@/store/useGuestAuth";
import { addDays, formatDateLabel } from "@/lib/scheduling";

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
  const { t, direction } = useI18n();
  const hydrated = useHydrated();
  const skipOtpEnabled = process.env.NEXT_PUBLIC_SKIP_OTP_ENABLED === "true";

  // Extract params
  const restaurantId = searchParams.get("restaurantId") || "";
  const orderType = (searchParams.get("orderType") as OrderType) || "pickup";
  const tableId = searchParams.get("tableId") || undefined;
  const sessionId = searchParams.get("sessionId") || undefined;

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
  const [deliveryNotes, setDeliveryNotes] = useState("");

  // OTP state
  const [otpCode, setOtpCode] = useState("");
  const [otpExpiry, setOtpExpiry] = useState(0);
  const [otpError, setOtpError] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [orderPlaced, setOrderPlaced] = useState(false);

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
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestIsVerified, guestPhone]);

  // Redirect if cart is empty (but not after order is placed)
  useEffect(() => {
    if (hydrated && lines.length === 0 && !orderPlaced) {
      router.push(`/r/${restaurantId}`);
    }
  }, [hydrated, lines.length, restaurantId, router, orderPlaced]);

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
      return sendOTP(normalizePhone(customerPhone));
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
      return verifyOTP(normalizePhone(customerPhone), otpCode);
    },
    onSuccess: (data) => {
      if (data.verified) {
        setPhoneVerified(true);
        setStep("confirm");
        setOtpError("");
        // Persist session so future checkouts skip OTP
        setGuestVerified(restaurantId, normalizePhone(customerPhone));
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
      // Dine-in = pay later; everything else (pickup, delivery, counter, scheduled) = pay before
      const requiresPrepayment = orderType !== "dine_in";
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
        deliveryNotes: orderType === "delivery" ? deliveryNotes : undefined,
        isScheduled: isScheduled || undefined,
        scheduledFor: isScheduled && scheduledFor ? scheduledFor : undefined,
        scheduledPickupWindowStart: isScheduled && selectedSlot ? selectedSlot.start : undefined,
        scheduledPickupWindowEnd: isScheduled && selectedSlot ? selectedSlot.end : undefined,
        items: lines.filter((l) => !l.comboId).map((line) => ({
          itemId: line.item.id,
          quantity: line.quantity,
          note: line.note,
          modifiers: line.modifiers?.map((modifier) => ({
            modifierId: modifier.id,
            applied: true,
          })),
        })),
        combos: lines.filter((l) => l.comboId && l.comboSelections).map((line) => ({
          comboMenuId: line.comboId!,
          selections: line.comboSelections!.map((sel) => ({
            stepId: sel.stepId,
            menuItemId: sel.menuItemId,
            quantity: sel.quantity,
            notes: sel.notes,
          })),
        })),
        paymentMethod: requiresPrepayment ? "pay_now" : "pay_later",
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
        // Pickup/delivery: go to tracking page
        const qs = `?restaurantId=${restaurantId}${tableId ? `&tableId=${tableId}` : ""}${sessionId ? `&sessionId=${sessionId}` : ""}`;
        router.push(`/order/tracking/${data.orderId}${qs}`);
      }
    },
  });

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Require date + slot when scheduling is enabled
    if (isScheduled && (!scheduledFor || !selectedSlot)) return;
    // For dine-in, skip OTP
    if (orderType === "dine_in") {
      setPhoneVerified(true);
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
                  <p className="text-sm text-[var(--text-muted)] mt-1">
                    {orderTypeIcon} {orderTypeLabel}
                  </p>
                </div>

                <form onSubmit={handleDetailsSubmit} className="space-y-4">
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
                      {t("phone")} {orderType !== "dine_in" && "*"}
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
                        required={orderType !== "dine_in"}
                        className="flex-1 px-4 py-3 border border-[var(--divider)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-[var(--surface)] text-[var(--text)]"
                        placeholder="50-123-4567"
                      />
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      {orderType === "dine_in" ? t("phoneOptional") : t("verifyPhoneDescription")}
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

                  {/* Batch fulfillment banner — shown when restaurant uses batch mode */}
                  {(orderType === "pickup" || orderType === "delivery") && restaurant?.batchFulfillmentEnabled && batchConfig?.enabled && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                      {batchConfig.orderingOpen ? (
                        <>
                          <p className="text-sm font-semibold text-amber-800">
                            {orderType === "delivery" ? "Delivery" : "Pickup"} info
                          </p>
                          {batchConfig.fulfillmentDays.map((day) => {
                            const window = orderType === "delivery" ? day.deliveryWindow : day.pickupWindow;
                            if (!window) return null;
                            return (
                              <p key={day.date} className="text-sm text-amber-700">
                                Your order will be {orderType === "delivery" ? "delivered" : "ready for pickup"} on{" "}
                                <span className="font-semibold">{day.dayName}, {formatDateLabel(day.date)}</span>{" "}
                                between <span className="font-semibold">{window.start} – {window.end}</span>
                              </p>
                            );
                          })}
                          <p className="text-xs text-amber-600">
                            Ordering closes {new Date(batchConfig.currentBatchCutoff).toLocaleDateString(undefined, { weekday: "long" })} at{" "}
                            {new Date(batchConfig.currentBatchCutoff).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-amber-700">
                          Ordering for this batch has closed. Please check back when the next ordering window opens.
                        </p>
                      )}
                    </div>
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
                            {formatDateLabel(scheduledFor)} · {selectedSlot.start} – {selectedSlot.end}
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
                                        {formatDateLabel(date)}
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
                          return window ? `${day.dayName} ${formatDateLabel(day.date)} · ${window.start} – ${window.end}` : day.dayName;
                        }).join(", ")}
                      </span>
                    </div>
                  ) : isScheduled && scheduledFor && selectedSlot ? (
                    <div className="flex items-center gap-2 text-sm font-medium text-brand">
                      <span>📅</span>
                      <span>
                        {formatDateLabel(scheduledFor)} · {selectedSlot.start} – {selectedSlot.end}
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
                        <p className="font-medium">{line.item.name}</p>
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

                <button
                  type="button"
                  onClick={handleConfirmOrder}
                  disabled={createOrderMutation.isPending || isBelowMinimum}
                  className="w-full py-4 rounded-xl bg-brand text-white font-bold shadow-lg shadow-brand/30 hover:bg-brand-dark transition disabled:opacity-50"
                >
                  {createOrderMutation.isPending
                    ? "..."
                    : restaurant?.batchFulfillmentEnabled && batchConfig?.requirePrepayment
                    ? "Place Order & Pay"
                    : restaurant?.batchFulfillmentEnabled
                    ? "Place Order"
                    : isScheduled && !restaurant?.schedulingRequirePrepayment
                    ? "Schedule Order"
                    : isScheduled
                    ? "Schedule & Pay"
                    : orderType === "dine_in"
                    ? t("confirmAndOrder") || t("confirmOrder")
                    : t("confirmAndPay") || t("confirmOrder")}
                </button>

                {createOrderMutation.isError && (
                  <p className="text-sm text-red-500 text-center">
                    {(createOrderMutation.error as any)?.message || "Failed to create order"}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
