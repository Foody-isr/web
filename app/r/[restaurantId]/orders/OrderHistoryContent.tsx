"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { fetchMyOrders, GuestOrder } from "@/services/api";
import { useI18n } from "@/lib/i18n";
import { useGuestAccount } from "@/store/useGuestAccount";
import { GoogleSignIn } from "@/components/GoogleSignIn";
import { BottomNav } from "@/components/BottomNav";

type Props = {
  restaurantId: string;
  restaurantSlug: string;
  restaurantName: string;
  restaurantLogoUrl?: string;
};

export function OrderHistoryContent({
  restaurantId,
  restaurantSlug,
  restaurantName,
  restaurantLogoUrl,
}: Props) {
  const router = useRouter();
  const { t, direction } = useI18n();

  // Single guest identity — the Google account, shared across the app.
  const account = useGuestAccount((s) => s.account);
  const token = useGuestAccount((s) => s.token);

  const ordersQuery = useQuery({
    queryKey: ["myOrders", restaurantId, token],
    queryFn: () => fetchMyOrders(restaurantId, 50),
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
          <h1 className="text-lg font-bold text-[var(--text)] truncate">
            {t("accountMyOrders") || "My Orders"}
          </h1>
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
                  <h2 className="text-xl font-bold">{t("accountMyOrders") || "View Your Orders"}</h2>
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

                {ordersQuery.data && ordersQuery.data.length === 0 && (
                  <div className="card p-8 text-center space-y-4">
                    <div className="text-6xl">📭</div>
                    <p className="text-[var(--text-muted)]">
                      {(t("reorderEmpty") || "No orders found at {name}").replace(
                        "{name}",
                        restaurantName
                      )}
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
                              <p className="font-bold text-lg">₪{order.total.toFixed(2)}</p>
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
      <div className="md:hidden" style={{ height: "var(--bottomnav-h)" }} aria-hidden />
      <BottomNav slug={restaurantSlug} active="orders" />
    </main>
  );
}
