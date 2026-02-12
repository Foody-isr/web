"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { fetchOrder, fetchRestaurant } from "@/services/api";
import { LanguageToggle } from "@/components/LanguageToggle";

// Loading component
function PaymentFailedLoading() {
  return (
    <main className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-12 h-12 bg-red-200 rounded-full" />
        <div className="h-4 w-32 bg-[var(--surface-subtle)] rounded" />
      </div>
    </main>
  );
}

function PaymentFailedContent({ params }: { params: { restaurantId: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, direction } = useI18n();
  
  const orderId = searchParams.get("orderId");
  const errorMessage = searchParams.get("error") || searchParams.get("errorMessage");
  const restaurantId = params.restaurantId;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderData, setOrderData] = useState<any>(null);
  const [restaurantData, setRestaurantData] = useState<any>(null);
  const [retrying, setRetrying] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  
  useEffect(() => {
    const loadOrderData = async () => {
      if (!orderId || !restaurantId) {
        setError(t("invalidOrderId"));
        setLoading(false);
        return;
      }
      
      try {
        // Fetch order details
        const order = await fetchOrder(orderId, restaurantId);
        
        // Fetch restaurant details
        const restaurant = await fetchRestaurant(restaurantId);
        
        setOrderData(order);
        setRestaurantData(restaurant);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || t("unableToLoadOrder"));
        setLoading(false);
      }
    };
    
    loadOrderData();
  }, [orderId, restaurantId, t]);
  
  const handleRetryPayment = async () => {
    if (!orderId || !restaurantId) return;
    
    setRetrying(true);
    setRetryError(null);
    
    try {
      // Call payment initialization endpoint using the same pattern as api.ts
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";
      const response = await fetch(
        `${API_BASE}/api/v1/public/orders/${orderId}/payment/init?restaurant_id=${restaurantId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(t("failedToInitPayment"));
      }
      
      const data = await response.json();
      
      // Redirect to PayPlus payment page
      if (data.payment_url) {
        window.location.href = data.payment_url;
      } else {
        throw new Error(t("noPaymentUrl"));
      }
    } catch (err: any) {
      setRetryError(err.message || t("failedToRetryPayment"));
      setRetrying(false);
    }
  };
  
  const handleCancelOrder = () => {
    setShowCancelConfirm(true);
  };
  
  const confirmCancelOrder = async () => {
    // Redirect back to table (dine-in) or restaurant page (pickup/delivery)
    const tableCode = orderData?.tableCode;
    const sessionId = orderData?.sessionId;
    if (tableCode) {
      router.push(`/r/${restaurantId}/table/${tableCode}${sessionId ? `?sessionId=${sessionId}` : ""}`);
    } else {
      router.push(`/r/${restaurantId}`);
    }
  };
  
  if (loading) {
    return <PaymentFailedLoading />;
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
  
  return (
    <main className="min-h-screen bg-[var(--bg-page)] pb-8" dir={direction}>
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[var(--surface)] border-b border-[var(--divider)] px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold">{t("paymentFailed")}</h1>
          <LanguageToggle />
        </div>
      </header>
      
      <div className="max-w-lg mx-auto px-4 pt-8">
        {/* Error Animation */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="mb-6"
        >
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 }}
                className="text-4xl"
              >
                ❌
              </motion.div>
            </div>
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-2xl font-bold text-red-600 mb-2"
            >
              {t("paymentFailed")}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-[var(--text-muted)]"
            >
              {t("paymentFailedMessage")}
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
              <p className="font-medium">{restaurantData.name}</p>
            )}
          </div>
          
          {/* Error Reason */}
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm font-medium text-red-800 mb-1">{t("reason")}:</p>
              <p className="text-sm text-red-600">{decodeURIComponent(errorMessage)}</p>
            </div>
          )}
          
          {/* Amount */}
          <div className="flex justify-between items-center py-3">
            <span className="text-[var(--text-muted)]">{t("amount")}:</span>
            <span className="text-2xl font-bold text-brand">₪{orderData.total.toFixed(2)}</span>
          </div>
        </motion.div>
        
        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="space-y-3 mb-6"
        >
          <button
            onClick={handleRetryPayment}
            disabled={retrying}
            className="w-full py-4 rounded-xl bg-brand text-white font-bold shadow-lg shadow-brand/30 hover:bg-brand-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {retrying ? t("redirectingToPayment") : t("tryAgain")}
          </button>
          
          {retryError && (
            <p className="text-sm text-red-500 text-center">{retryError}</p>
          )}
          
          <button
            onClick={handleCancelOrder}
            className="w-full py-4 rounded-xl bg-[var(--surface-subtle)] text-[var(--text)] font-medium hover:bg-[var(--surface-elevated)] transition"
          >
            {t("cancelOrder")}
          </button>
        </motion.div>
        
        {/* Support Message */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="text-center text-sm text-[var(--text-muted)]"
        >
          <p>{t("needHelp")}</p>
          {restaurantData?.phone && (
            <a
              href={`tel:${restaurantData.phone}`}
              className="text-brand hover:underline mt-2 inline-block"
            >
              📞 {restaurantData.phone}
            </a>
          )}
        </motion.div>
      </div>
      
      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card p-6 max-w-sm w-full space-y-4"
          >
            <h3 className="text-lg font-bold">{t("cancelOrderConfirm")}</h3>
            <p className="text-[var(--text-muted)]">
              {t("cancelOrderConfirmMessage")}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-[var(--surface-subtle)] font-medium hover:bg-[var(--surface-elevated)] transition"
              >
                {t("goBack")}
              </button>
              <button
                onClick={confirmCancelOrder}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition"
              >
                {t("cancelOrder")}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}

// Main page component wrapped in Suspense
export default function PaymentFailedPage({ params }: { params: { restaurantId: string } }) {
  return (
    <Suspense fallback={<PaymentFailedLoading />}>
      <PaymentFailedContent params={params} />
    </Suspense>
  );
}
