"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { useMutation, useQuery } from "@tanstack/react-query";
import { sendOTP, verifyOTP, fetchOrderHistory, OrderHistoryItem } from "@/services/api";
import { useI18n } from "@/lib/i18n";
import { useGuestAuth } from "@/store/useGuestAuth";

type Props = {
  restaurantId: string;
  restaurantSlug: string;
  restaurantName: string;
  restaurantLogoUrl?: string;
};

type ViewStep = "phone" | "verify" | "orders";

export function OrderHistoryContent({
  restaurantId,
  restaurantSlug,
  restaurantName,
  restaurantLogoUrl,
}: Props) {
  const router = useRouter();
  const { direction } = useI18n();

  // Guest auth
  const isVerified = useGuestAuth((s) => s.isVerified(restaurantId));
  const savedPhone = useGuestAuth((s) => s.getPhone(restaurantId));
  const setVerified = useGuestAuth((s) => s.setVerified);

  // Determine initial step based on auth state
  const [step, setStep] = useState<ViewStep>(isVerified ? "orders" : "phone");
  const [phone, setPhone] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState(savedPhone || "");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [countdown, setCountdown] = useState(0);

  // If already verified, use saved phone
  useEffect(() => {
    if (isVerified && savedPhone) {
      setNormalizedPhone(savedPhone);
      setStep("orders");
    }
  }, [isVerified, savedPhone]);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

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
    onError: (error: Error) => {
      setOtpError(error.message || "Failed to send code");
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: () => verifyOTP(normalizedPhone, otpCode),
    onSuccess: (data) => {
      if (data.verified) {
        setVerified(restaurantId, normalizedPhone);
        setStep("orders");
        setOtpError("");
      } else {
        setOtpError("Invalid code. Please try again.");
      }
    },
    onError: (error: Error) => {
      setOtpError(error.message || "Invalid code");
    },
  });

  const ordersQuery = useQuery({
    queryKey: ["orderHistory", normalizedPhone, restaurantId],
    queryFn: () => fetchOrderHistory(normalizedPhone, restaurantId),
    enabled: step === "orders" && !!normalizedPhone,
    staleTime: 30000,
  });

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
    <main className="min-h-screen bg-[var(--bg-page)] pb-8" dir={direction}>
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[var(--surface)] border-b border-[var(--divider)] px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button
            onClick={() => router.push(`/r/${restaurantSlug}/order`)}
            className="w-9 h-9 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] transition"
            aria-label="Back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={direction === "rtl" ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"}
              />
            </svg>
          </button>
          {restaurantLogoUrl && (
            <Image
              src={restaurantLogoUrl}
              alt={restaurantName}
              width={32}
              height={32}
              className="w-8 h-8 rounded-full object-cover"
            />
          )}
          <h1 className="text-lg font-bold text-[var(--text)] truncate">My Orders</h1>
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
                  <h2 className="text-xl font-bold">View Your Orders</h2>
                  <p className="text-sm text-[var(--text-muted)] mt-2">
                    Enter your phone number to view your order history at {restaurantName}
                  </p>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendOtpMutation.mutate();
                  }}
                  className="space-y-4"
                >
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-[var(--divider)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-[var(--surface)] text-[var(--text)]"
                    placeholder="050-123-4567"
                    dir="ltr"
                  />
                  {otpError && <p className="text-sm text-red-500 text-center">{otpError}</p>}
                  <button
                    type="submit"
                    disabled={sendOtpMutation.isPending || !phone}
                    className="w-full py-4 rounded-xl bg-brand text-white font-bold shadow-lg shadow-brand/30 hover:bg-brand-dark transition disabled:opacity-50"
                  >
                    {sendOtpMutation.isPending ? "Sending..." : "Send Code"}
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
                  <h2 className="text-xl font-bold">Verify Phone</h2>
                  <p className="text-sm text-[var(--text-muted)] mt-1">
                    Enter the code sent to <span className="font-mono font-bold">{phone}</span>
                  </p>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    verifyOtpMutation.mutate();
                  }}
                  className="space-y-4"
                >
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
                  {otpError && <p className="text-sm text-red-500 text-center">{otpError}</p>}
                  <button
                    type="submit"
                    disabled={otpCode.length !== 6 || verifyOtpMutation.isPending}
                    className="w-full py-4 rounded-xl bg-brand text-white font-bold shadow-lg shadow-brand/30 hover:bg-brand-dark transition disabled:opacity-50"
                  >
                    {verifyOtpMutation.isPending ? "Verifying..." : "Verify"}
                  </button>
                  <div className="flex items-center justify-between text-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setStep("phone");
                        setOtpCode("");
                        setOtpError("");
                      }}
                      className="text-[var(--text-muted)] hover:text-[var(--text)]"
                    >
                      Change number
                    </button>
                    <button
                      type="button"
                      onClick={() => sendOtpMutation.mutate()}
                      disabled={countdown > 0 || sendOtpMutation.isPending}
                      className="text-brand hover:underline disabled:opacity-50 disabled:no-underline"
                    >
                      {countdown > 0 ? `Resend (${countdown}s)` : "Resend"}
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
                {ordersQuery.isLoading && (
                  <div className="card p-8 text-center">
                    <div className="animate-pulse text-[var(--text-muted)]">Loading orders...</div>
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
                    <p className="text-[var(--text-muted)]">
                      No orders found at {restaurantName}
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
                              <p className="text-sm text-[var(--text-muted)] mt-1">
                                {new Date(order.created_at).toLocaleDateString(
                                  direction === "rtl" ? "he-IL" : "en-US",
                                  { dateStyle: "medium" }
                                )}
                              </p>
                              <p className="text-sm text-[var(--text-muted)]">
                                {order.item_count} {order.item_count === 1 ? "item" : "items"}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-lg">₪{order.total_amount.toFixed(2)}</p>
                              <span
                                className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                  order.order_status === "served" || order.order_status === "ready"
                                    ? "bg-green-100 text-green-800"
                                    : order.order_status === "cancelled" || order.order_status === "rejected"
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
