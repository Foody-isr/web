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

type CheckoutStep = "details" | "verify" | "confirm";

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
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"pay_now" | "pay_later">("pay_later");

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
      const normalizedPhone = customerPhone.startsWith("+")
        ? customerPhone
        : `+972${customerPhone.replace(/^0/, "")}`;
      return sendOTP(normalizedPhone);
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
      const normalizedPhone = customerPhone.startsWith("+")
        ? customerPhone
        : `+972${customerPhone.replace(/^0/, "")}`;
      return verifyOTP(normalizedPhone, otpCode);
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
        customerPhone: customerPhone.startsWith("+")
          ? customerPhone
          : `+972${customerPhone.replace(/^0/, "")}`,
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
        paymentMethod,
      };
      return createOrder(payload);
    },
    onSuccess: (data) => {
      setOrderPlaced(true);
      clear();
      const qs = `?restaurantId=${restaurantId}${tableId ? `&tableId=${tableId}` : ""}`;
      router.push(`/order/tracking/${data.orderId}${qs}`);
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
    <main className="min-h-screen bg-light-surface pb-8" dir={direction}>
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[var(--surface)] border-b border-light-divider px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/r/${restaurant?.slug || restaurantId}/${orderType}`}
              className="text-ink-muted hover:text-ink transition"
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
                    : "bg-light-surface-2 text-ink-muted"
                }`}
              >
                {i < ["details", "verify", "confirm"].indexOf(step) ? "✓" : i + 1}
              </div>
              {i < 2 && (
                <div
                  className={`w-8 h-0.5 transition ${
                    i < ["details", "verify", "confirm"].indexOf(step)
                      ? "bg-green-500"
                      : "bg-light-divider"
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
                  <p className="text-sm text-ink-muted mt-1">
                    {orderTypeIcon} {orderTypeLabel}
                  </p>
                </div>

                <form onSubmit={handleDetailsSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-ink-muted mb-1">
                      {t("name")} *
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      required
                      className="w-full px-4 py-3 border border-light-divider rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-white"
                      placeholder={t("yourName")}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-ink-muted mb-1">
                      {t("phone")} *
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      required
                      className="w-full px-4 py-3 border border-light-divider rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-white"
                      placeholder="050-123-4567"
                      dir="ltr"
                    />
                    <p className="text-xs text-ink-muted mt-1">
                      {orderType !== "dine_in" && t("verifyPhoneDescription")}
                    </p>
                  </div>

                  {orderType === "delivery" && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-ink-muted mb-1">
                          {t("deliveryAddress")} *
                        </label>
                        <textarea
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          required
                          rows={2}
                          className="w-full px-4 py-3 border border-light-divider rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-white resize-none"
                          placeholder={t("fullAddress")}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-ink-muted mb-1">
                          {t("deliveryNotes")}
                        </label>
                        <input
                          type="text"
                          value={deliveryNotes}
                          onChange={(e) => setDeliveryNotes(e.target.value)}
                          className="w-full px-4 py-3 border border-light-divider rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-white"
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
                  <p className="text-sm text-ink-muted mt-1">
                    {t("codeSent")} <span className="font-mono font-bold">{customerPhone}</span>
                  </p>
                </div>

                <form onSubmit={handleVerifySubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-ink-muted mb-1">
                      {t("enterCode")}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      className="w-full px-4 py-4 text-center text-2xl font-mono tracking-[0.5em] border border-light-divider rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-white"
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
                      className="text-ink-muted hover:text-ink"
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
                <div className="bg-light-surface-2 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span>{orderTypeIcon}</span>
                    <span className="font-medium">{orderTypeLabel}</span>
                  </div>
                  <div className="text-sm text-ink-muted">
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
                    <div key={line.id} className="flex items-start gap-3 py-2 border-b border-light-divider last:border-0">
                      <div className="flex-1">
                        <p className="font-medium">{line.item.name}</p>
                        {line.modifiers && line.modifiers.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {line.modifiers.map((modifier) => (
                              <span
                                key={modifier.id}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-light-surface-2 text-ink-muted"
                              >
                                {formatModifierLabel(modifier)}
                              </span>
                            ))}
                          </div>
                        )}
                        {line.note && <p className="text-xs text-ink-muted mt-1">{line.note}</p>}
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{currency} {lineTotal(line).toFixed(2)}</p>
                        <p className="text-xs text-ink-muted">×{line.quantity}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Payment Method */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-ink-muted">Payment</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("pay_later")}
                      className={`py-3 px-4 rounded-xl border-2 transition ${
                        paymentMethod === "pay_later"
                          ? "border-brand bg-brand/5"
                          : "border-light-divider hover:border-brand/50"
                      }`}
                    >
                      <span className="text-sm font-medium">{t("payLater")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("pay_now")}
                      className={`py-3 px-4 rounded-xl border-2 transition ${
                        paymentMethod === "pay_now"
                          ? "border-brand bg-brand/5"
                          : "border-light-divider hover:border-brand/50"
                      }`}
                    >
                      <span className="text-sm font-medium">{t("payNow")}</span>
                    </button>
                  </div>
                </div>

                {/* Total */}
                <div className="flex items-center justify-between py-4 border-t border-light-divider">
                  <div>
                    <p className="text-sm text-ink-muted">{t("total")}</p>
                    <p className="text-sm text-ink-muted">
                      {totalItems} {t("items")}
                    </p>
                  </div>
                  <p className="text-2xl font-bold">
                    {currency} {displayTotal.toFixed(2)}
                  </p>
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
