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
} from "@/services/api";
import { OrderPayload, OrderType, Restaurant } from "@/lib/types";
import { formatModifierLabel, lineTotal, lineUnitPrice } from "@/lib/cart";
import { LanguageToggle } from "@/components/LanguageToggle";
import { VAT_MULTIPLIER } from "@/lib/constants";

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

  // Extract params
  const restaurantId = searchParams.get("restaurantId") || "";
  const orderType = (searchParams.get("orderType") as OrderType) || "pickup";
  const tableId = searchParams.get("tableId") || undefined;
  const sessionId = searchParams.get("sessionId") || undefined;

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

  // Computed values
  const displayLines = hydrated ? lines : [];
  const displayTotal = hydrated ? total() : 0;
  const totalItems = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity, 0),
    [lines]
  );

  // Normalize phone number with country code
  const normalizePhone = (phone: string) => {
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

  // Redirect if cart is empty (but not after order is placed)
  useEffect(() => {
    if (hydrated && lines.length === 0 && !orderPlaced) {
      router.push(`/r/${restaurantId}`);
    }
  }, [hydrated, lines.length, restaurantId, router, orderPlaced]);

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
      const payload: OrderPayload = {
        restaurantId,
        tableId,
        sessionId,
        orderType,
        customerName,
        customerPhone: normalizePhone(customerPhone),
        deliveryAddress: orderType === "delivery" ? deliveryAddress : undefined,
        deliveryNotes: orderType === "delivery" ? deliveryNotes : undefined,
        items: lines.map((line) => ({
          itemId: line.item.id,
          quantity: line.quantity,
          note: line.note,
          modifiers: line.modifiers?.map((modifier) => ({
            modifierId: modifier.id,
            applied: true,
          })),
        })),
        paymentMethod: "pay_now",
        paymentRequired: true,
      };
      return createOrder(payload);
    },
    onSuccess: (data) => {
      setOrderPlaced(true);
      clear();
      
      // If payment URL is provided, redirect to PayPlus
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        // Otherwise, redirect to tracking page
        const qs = `?restaurantId=${restaurantId}${tableId ? `&tableId=${tableId}` : ""}`;
        router.push(`/order/tracking/${data.orderId}${qs}`);
      }
    },
  });

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
              href={`/r/${restaurant?.slug || restaurantId}/${orderType}`}
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
        <div className="flex items-center justify-center gap-2 text-sm">
          {["details", "verify", "confirm"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition ${
                  step === s
                    ? "bg-brand text-white"
                    : i < ["details", "verify", "confirm"].indexOf(step)
                    ? "bg-green-500 text-white"
                    : "bg-[var(--surface-subtle)] text-[var(--text-muted)]"
                }`}
              >
                {i < ["details", "verify", "confirm"].indexOf(step) ? "✓" : i + 1}
              </div>
              {i < 2 && (
                <div
                  className={`w-8 h-0.5 transition ${
                    i < ["details", "verify", "confirm"].indexOf(step)
                      ? "bg-green-500"
                      : "bg-[var(--divider)]"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
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
                  <h2 className="text-xl font-bold">{orderType === "delivery" ? t("deliveryDetails") : t("pickupDetails")}</h2>
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
                      {t("phone")} *
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
                        required
                        className="flex-1 px-4 py-3 border border-[var(--divider)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-[var(--surface)] text-[var(--text)]"
                        placeholder="50-123-4567"
                      />
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      {orderType !== "dine_in" && t("verifyPhoneDescription")}
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

                  <button
                    type="submit"
                    disabled={sendOtpMutation.isPending}
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
                    href={`/r/${restaurant?.slug || restaurantId}/${orderType}`}
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
                  <div className="text-sm text-[var(--text-muted)]">
                    <p>{customerName}</p>
                    <p dir="ltr" className="font-mono">{customerPhone}</p>
                    {orderType === "delivery" && deliveryAddress && (
                      <p className="mt-1">{deliveryAddress}</p>
                    )}
                  </div>
                </div>

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
                  disabled={createOrderMutation.isPending}
                  className="w-full py-4 rounded-xl bg-brand text-white font-bold shadow-lg shadow-brand/30 hover:bg-brand-dark transition disabled:opacity-50"
                >
                  {createOrderMutation.isPending ? "..." : t("confirmOrder")}
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
