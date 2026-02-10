"use client";

import { Suspense, useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  sendOTP,
  verifyOTP,
  fetchOrderHistory,
  OrderHistoryItem,
} from "@/services/api";
import { LanguageToggle } from "@/components/LanguageToggle";

type ViewStep = "phone" | "verify" | "orders";

function OrderHistoryLoading() {
  return (
    <main className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-12 h-12 bg-brand/20 rounded-full" />
        <div className="h-4 w-32 bg-neutral-200 rounded" />
      </div>
    </main>
  );
}

export default function OrderHistoryPage() {
  return (
    <Suspense fallback={<OrderHistoryLoading />}>
      <OrderHistoryContent />
    </Suspense>
  );
}

function OrderHistoryContent() {
  const { t, direction } = useI18n();
  const [step, setStep] = useState<ViewStep>("phone");
  const [phone, setPhone] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [countdown, setCountdown] = useState(0);

  // Countdown timer for OTP
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Send OTP mutation
  const sendOtpMutation = useMutation({
    mutationFn: async () => {
      const normalized = phone.startsWith("+")
        ? phone
        : `+972${phone.replace(/^0/, "")}`;
      setNormalizedPhone(normalized);
      return sendOTP(normalized);
    },
    onSuccess: () => {
      setCountdown(60);
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
      return verifyOTP(normalizedPhone, otpCode);
    },
    onSuccess: (data) => {
      if (data.verified) {
        setStep("orders");
        setOtpError("");
      } else {
        setOtpError(data.error || t("invalidCode"));
      }
    },
    onError: (error: any) => {
      setOtpError(error.message || t("invalidCode"));
    },
  });

  // Fetch order history query
  const ordersQuery = useQuery({
    queryKey: ["orderHistory", normalizedPhone],
    queryFn: () => fetchOrderHistory(normalizedPhone),
    enabled: step === "orders" && !!normalizedPhone,
    staleTime: 30000,
  });

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendOtpMutation.mutate();
  };

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyOtpMutation.mutate();
  };

  const orderStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      pending_review: "Pending",
      accepted: "Accepted",
      in_kitchen: "In Kitchen",
      ready: "Ready",
      served: "Served",
      rejected: "Rejected",
      cancelled: "Cancelled",
    };
    return labels[status] || status;
  };

  const orderTypeEmoji: Record<string, string> = {
    dine_in: "🍽️",
    pickup: "🛍️",
    delivery: "🚗",
  };

  return (
    <main className="min-h-screen bg-light-surface pb-8" dir={direction}>
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[var(--surface)] border-b border-light-divider px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link href="/" className="text-ink-muted hover:text-ink transition">
            ← {t("home") || "Home"}
          </Link>
          <h1 className="text-lg font-bold">{t("orderHistory") || "Order History"}</h1>
          <LanguageToggle />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {/* Step 1: Enter Phone */}
          {step === "phone" && (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="card p-6 space-y-6">
                <div className="text-center">
                  <div className="text-6xl mb-4">📱</div>
                  <h2 className="text-xl font-bold">{t("viewPastOrders") || "View Your Orders"}</h2>
                  <p className="text-sm text-ink-muted mt-2">
                    {t("enterPhoneToViewOrders") ||
                      "Enter your phone number to view your order history"}
                  </p>
                </div>

                <form onSubmit={handlePhoneSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-ink-muted mb-1">
                      {t("phone")} *
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      className="w-full px-4 py-3 border border-light-divider rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-white"
                      placeholder="050-123-4567"
                      dir="ltr"
                    />
                  </div>

                  {otpError && (
                    <p className="text-sm text-red-500 text-center">{otpError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={sendOtpMutation.isPending || !phone}
                    className="w-full py-4 rounded-xl bg-brand text-white font-bold shadow-lg shadow-brand/30 hover:bg-brand-dark transition disabled:opacity-50"
                  >
                    {sendOtpMutation.isPending ? "..." : t("continue")}
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {/* Step 2: Verify OTP */}
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
                    {t("codeSent")} <span className="font-mono font-bold">{phone}</span>
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
                      onClick={() => {
                        setStep("phone");
                        setOtpCode("");
                        setOtpError("");
                      }}
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

          {/* Step 3: Order List */}
          {step === "orders" && (
            <motion.div
              key="orders"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold">{t("yourOrders") || "Your Orders"}</h2>
                  <span className="text-sm text-ink-muted">{phone}</span>
                </div>

                {ordersQuery.isLoading && (
                  <div className="card p-8 text-center">
                    <div className="animate-pulse">Loading orders...</div>
                  </div>
                )}

                {ordersQuery.isError && (
                  <div className="card p-8 text-center text-red-500">
                    Failed to load orders. Please try again.
                  </div>
                )}

                {ordersQuery.data && ordersQuery.data.orders.length === 0 && (
                  <div className="card p-8 text-center space-y-4">
                    <div className="text-6xl">📭</div>
                    <p className="text-ink-muted">
                      {t("noOrdersFound") || "No orders found for this phone number"}
                    </p>
                  </div>
                )}

                {ordersQuery.data && ordersQuery.data.orders.length > 0 && (
                  <div className="space-y-3">
                    {ordersQuery.data.orders.map((order: OrderHistoryItem) => (
                      <Link
                        key={order.id}
                        href={`/receipt/${order.receipt_token}`}
                        className="block"
                      >
                        <div className="card p-4 hover:shadow-lg transition">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-lg">
                                  {orderTypeEmoji[order.order_type] || "📦"}
                                </span>
                                <span className="font-bold">Order #{order.id}</span>
                              </div>
                              <p className="text-sm text-ink-muted mt-1">
                                {new Date(order.created_at).toLocaleDateString(
                                  direction === "rtl" ? "he-IL" : "en-US",
                                  {
                                    dateStyle: "medium",
                                  }
                                )}
                              </p>
                              <p className="text-sm text-ink-muted">
                                {order.item_count} {order.item_count === 1 ? "item" : "items"}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-lg">₪{order.total_amount.toFixed(2)}</p>
                              <span
                                className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                  order.order_status === "served" || order.order_status === "ready"
                                    ? "bg-green-100 text-green-800"
                                    : order.order_status === "cancelled" ||
                                      order.order_status === "rejected"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-blue-100 text-blue-800"
                                }`}
                              >
                                {orderStatusLabel(order.order_status)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
