"use client";

import { Suspense } from "react";
import { useI18n, useCurrency } from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchMyOrders, GuestOrder } from "@/services/api";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useGuestAccount } from "@/store/useGuestAccount";
import { GoogleSignIn } from "@/components/GoogleSignIn";

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
  const { money } = useCurrency();
  const { t, direction } = useI18n();

  // Single guest identity — the Google account, shared across the app. The
  // global page lists orders across every restaurant the guest ordered from.
  const account = useGuestAccount((s) => s.account);
  const token = useGuestAccount((s) => s.token);

  const ordersQuery = useQuery({
    queryKey: ["myOrders", "all", token],
    queryFn: () => fetchMyOrders(undefined, 50),
    enabled: !!token,
    staleTime: 30000,
  });

  const orderStatusLabel = (status?: string): string => {
    const labels: Record<string, string> = {
      pending_review: "Pending",
      accepted: "Accepted",
      in_kitchen: "In Kitchen",
      ready: "Ready",
      served: "Served",
      rejected: "Rejected",
      cancelled: "Cancelled",
    };
    return (status && labels[status]) || status || "";
  };

  const orderTypeEmoji: Record<string, string> = {
    dine_in: "🍽️",
    pickup: "🛍️",
    delivery: "🚗",
  };

  return (
    <main className="min-h-screen bg-[var(--bg-page)] pb-8" dir={direction}>
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[var(--surface)] border-b border-[var(--divider)] px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link href="/" className="text-[var(--text-muted)] hover:text-[var(--text)] transition">
            ← {t("home") || "Home"}
          </Link>
          <h1 className="text-lg font-bold">{t("orderHistory") || "Order History"}</h1>
          <LanguageToggle />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {/* Signed out → prompt to sign in with Google */}
          {!account ? (
            <motion.div
              key="signin"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="card p-6 space-y-6">
                <div className="text-center">
                  <div className="text-6xl mb-4">🧾</div>
                  <h2 className="text-xl font-bold">{t("viewPastOrders") || "View Your Orders"}</h2>
                  <p className="text-sm text-[var(--text-muted)] mt-2">
                    {t("accountSignInHint") ||
                      "Sign in to find your past orders and check out faster."}
                  </p>
                </div>
                <GoogleSignIn />
              </div>
            </motion.div>
          ) : (
            /* Signed in → order list */
            <motion.div
              key="orders"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold">{t("yourOrders") || "Your Orders"}</h2>
                  <span className="text-sm text-[var(--text-muted)] truncate">
                    {account.name || account.email}
                  </span>
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

                {ordersQuery.data && ordersQuery.data.length === 0 && (
                  <div className="card p-8 text-center space-y-4">
                    <div className="text-6xl">📭</div>
                    <p className="text-[var(--text-muted)]">
                      {t("noOrdersFound") || "No orders found"}
                    </p>
                  </div>
                )}

                {ordersQuery.data && ordersQuery.data.length > 0 && (
                  <div className="space-y-3">
                    {ordersQuery.data.map((order: GuestOrder) => {
                      const inner = (
                        <div className="card p-4 hover:shadow-lg transition">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-lg">
                                  {orderTypeEmoji[order.order_type || ""] || "📦"}
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
                                {order.item_count ?? order.items.length}{" "}
                                {(order.item_count ?? order.items.length) === 1 ? "item" : "items"}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-lg">{money(order.total)}</p>
                              {order.order_status && (
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
                              )}
                            </div>
                          </div>
                        </div>
                      );
                      return order.receipt_token ? (
                        <Link key={order.id} href={`/receipt/${order.receipt_token}`} className="block">
                          {inner}
                        </Link>
                      ) : (
                        <div key={order.id}>{inner}</div>
                      );
                    })}
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
