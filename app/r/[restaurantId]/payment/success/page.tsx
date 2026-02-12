"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { fetchOrder, fetchRestaurant } from "@/services/api";
import { LanguageToggle } from "@/components/LanguageToggle";
import { calculateVAT } from "@/lib/constants";

// Loading component
function PaymentSuccessLoading() {
  return (
    <main className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-12 h-12 bg-brand/20 rounded-full" />
        <div className="h-4 w-32 bg-[var(--surface-subtle)] rounded" />
      </div>
    </main>
  );
}

function PaymentSuccessContent({ params }: { params: { restaurantId: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, direction } = useI18n();
  
  const orderId = searchParams.get("orderId");
  const restaurantId = params.restaurantId;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderData, setOrderData] = useState<any>(null);
  const [restaurantData, setRestaurantData] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  
  useEffect(() => {
    const loadOrderData = async () => {
      if (!orderId || !restaurantId) {
        setError("Invalid order ID or restaurant ID");
        setLoading(false);
        return;
      }
      
      try {
        // Fetch order details
        const order = await fetchOrder(orderId, restaurantId);
        
        // Fetch restaurant details
        const restaurant = await fetchRestaurant(restaurantId);
        
        // In a real scenario, we'd fetch order items from a detailed API
        // For now, we'll use the order response data
        setOrderData(order);
        setRestaurantData(restaurant);
        
        // Fetch full order details with items (this would need a different endpoint)
        // For now we'll simulate with basic data
        setItems([]);
        
        setLoading(false);
      } catch (err: any) {
        setError(err.message || "Failed to load order details");
        setLoading(false);
      }
    };
    
    loadOrderData();
  }, [orderId, restaurantId]);
  
  if (loading) {
    return <PaymentSuccessLoading />;
  }
  
  if (error || !orderData) {
    return (
      <main className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center p-4" dir={direction}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card p-8 text-center max-w-md w-full space-y-4"
        >
          <div className="text-6xl">❌</div>
          <h1 className="text-xl font-bold">{t("orderNotFound")}</h1>
          <p className="text-[var(--text-muted)]">{error || t("unableToLoadOrder")}</p>
          <Link
            href={`/r/${restaurantId}`}
            className="inline-block px-6 py-3 bg-brand text-white rounded-xl font-medium hover:bg-brand-dark transition"
          >
            {t("returnToMenu")}
          </Link>
        </motion.div>
      </main>
    );
  }
  
  const { subtotal, vat } = calculateVAT(orderData.total);
  
  // Build URLs based on order type — dine-in goes back to table page, others to tracking
  const isDineIn = orderData.orderType === "dine_in";
  const tableCode = orderData.tableCode;
  const sessionId = orderData.sessionId;
  
  // For dine-in: go to table page (shows all table orders + menu)
  // For pickup/delivery: go to single-order tracking page
  const tableUrl = tableCode
    ? `/r/${restaurantId}/table/${tableCode}${sessionId ? `?sessionId=${sessionId}` : ""}`
    : null;
  
  const trackingUrl = isDineIn && tableUrl
    ? tableUrl
    : `/order/tracking/${orderId}?restaurantId=${restaurantId}${tableCode ? `&tableId=${tableCode}` : ""}${sessionId ? `&sessionId=${sessionId}` : ""}`;
  
  const menuUrl = isDineIn && tableUrl
    ? tableUrl
    : `/r/${restaurantId}`;
  
  return (
    <main className="min-h-screen bg-[var(--bg-page)] pb-8" dir={direction}>
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[var(--surface)] border-b border-[var(--divider)] px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold">{t("paymentSuccess")}</h1>
          <LanguageToggle />
        </div>
      </header>
      
      <div className="max-w-lg mx-auto px-4 pt-8">
        {/* Success Animation */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="mb-6"
        >
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 }}
                className="text-4xl"
              >
                ✅
              </motion.div>
            </div>
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-2xl font-bold text-green-600 mb-2"
            >
              {t("paymentSuccess")}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-[var(--text-muted)]"
            >
              {t("paymentSuccessMessage")}
            </motion.p>
          </div>
        </motion.div>
        
        {/* Order Details Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="card p-6 space-y-4 mb-4"
        >
          {/* Order Info */}
          <div className="text-center pb-4 border-b border-[var(--divider)]">
            <p className="text-sm text-[var(--text-muted)] mb-1">{t("order")} #{orderId}</p>
            {restaurantData && (
              <p className="font-medium">
                {orderData.externalMetadata?.table_code && `${t("table")} ${orderData.externalMetadata.table_code} • `}
                {restaurantData.name}
              </p>
            )}
          </div>
          
          {/* Items Section - Placeholder since we don't have item details in basic order response */}
          {items.length > 0 && (
            <div className="space-y-3 py-4 border-b border-[var(--divider)]">
              {items.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-medium">
                      {item.quantity}× {item.name}
                    </p>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.modifiers.map((mod: any, modIdx: number) => (
                          <span
                            key={modIdx}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--surface-subtle)] text-[var(--text-muted)]"
                          >
                            + {mod.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="font-medium">₪{item.total.toFixed(2)}</p>
                </div>
              ))}
            </div>
          )}
          
          {/* Payment Summary */}
          <div className="space-y-2">
            <div className="flex justify-between text-[var(--text-muted)]">
              <span>{t("subtotal")}</span>
              <span>₪{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[var(--text-muted)]">
              <span>{t("vat")} (18%)</span>
              <span>₪{vat.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t border-[var(--divider)] pt-2">
              <span>{t("total")}</span>
              <span className="text-brand">₪{orderData.total.toFixed(2)}</span>
            </div>
          </div>
        </motion.div>
        
        {/* Preparation Message */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-center mb-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
            <span className="animate-pulse">👨‍🍳</span>
            <span>{t("orderBeingPrepared")}</span>
          </div>
        </motion.div>
        
        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="space-y-3"
        >
          {isDineIn ? (
            <Link
              href={trackingUrl}
              className="block w-full py-4 rounded-xl bg-brand text-white font-bold text-center shadow-lg shadow-brand/30 hover:bg-brand-dark transition"
            >
              {t("backToTable")}
            </Link>
          ) : (
            <>
              <Link
                href={trackingUrl}
                className="block w-full py-4 rounded-xl bg-brand text-white font-bold text-center shadow-lg shadow-brand/30 hover:bg-brand-dark transition"
              >
                {t("trackOrderStatus")}
              </Link>
              <Link
                href={menuUrl}
                className="block w-full py-4 rounded-xl bg-[var(--surface-subtle)] text-[var(--text)] font-medium text-center hover:bg-[var(--surface-elevated)] transition"
              >
                {t("returnToMenu")}
              </Link>
            </>
          )}
        </motion.div>
      </div>
    </main>
  );
}

// Main page component wrapped in Suspense
export default function PaymentSuccessPage({ params }: { params: { restaurantId: string } }) {
  return (
    <Suspense fallback={<PaymentSuccessLoading />}>
      <PaymentSuccessContent params={params} />
    </Suspense>
  );
}
