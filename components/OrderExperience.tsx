"use client";

import { CategoryTabs, ALL_CATEGORY_ID } from "@/components/CategoryTabs";
import { CartDrawer } from "@/components/CartDrawer";
import { ItemModal } from "@/components/ItemModal";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MenuItemCard } from "@/components/MenuItemCard";
import { PaymentSheet } from "@/components/PaymentSheet";
import { SplitPayment } from "@/components/SplitPayment";
import { useI18n } from "@/lib/i18n";
import { MenuItem, MenuResponse, OrderPayload, OrderType, Restaurant } from "@/lib/types";
import { useCartStore } from "@/store/useCartStore";
import { createOrder } from "@/services/api";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Props = {
  menu: MenuResponse;
  restaurant: Restaurant;
  orderType: OrderType;
  tableId?: string;
  sessionId?: string;
};

export function OrderExperience({ menu, restaurant, orderType, tableId, sessionId }: Props) {
  const router = useRouter();
  const { t, direction } = useI18n();
  const setContext = useCartStore((s) => s.setContext);
  const addItem = useCartStore((s) => s.addItem);
  const lines = useCartStore((s) => s.lines);
  const total = useCartStore((s) => s.total);

  const restaurantId = String(restaurant.id);

  useEffect(() => {
    setContext(restaurantId, menu.currency);
  }, [restaurantId, menu.currency, setContext]);

  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORY_ID);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [cartOpen, setCartOpen] = useState(true);
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [showSplit, setShowSplit] = useState(false);
  
  // Customer info for pickup/delivery
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [showCustomerForm, setShowCustomerForm] = useState(false);

  const itemsByCategory = useMemo(
    () =>
      menu.items.reduce<Record<string, MenuItem[]>>((acc, item) => {
        acc[item.categoryId] = acc[item.categoryId] ? [...acc[item.categoryId], item] : [item];
        return acc;
      }, {}),
    [menu.items]
  );

  const mutation = useMutation({
    mutationFn: async ({
      splitByItemIds
    }: {
      splitByItemIds?: string[];
    }) => {
      const payload: OrderPayload = {
        restaurantId,
        tableId,
        sessionId,
        orderType,
        customerName: orderType !== "dine_in" ? customerName : undefined,
        customerPhone: orderType !== "dine_in" ? customerPhone : undefined,
        deliveryAddress: orderType === "delivery" ? deliveryAddress : undefined,
        deliveryNotes: orderType === "delivery" ? deliveryNotes : undefined,
        items: lines.map((line) => ({
          itemId: line.item.id,
          quantity: line.quantity,
          note: line.note,
          modifiers: line.modifiers?.map((modifier) => ({
            modifierId: modifier.id,
            applied: true
          }))
        })),
        paymentMethod: "pay_now",
        paymentRequired: true,
        splitByItemIds
      };
      return createOrder(payload);
    },
    onSuccess: (data) => {
      useCartStore.getState().clear();
      
      // If payment URL is provided, redirect to PayPlus
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        // Otherwise, redirect to tracking page
        const qs = `?restaurantId=${restaurantId}${tableId ? `&tableId=${tableId}` : ""}`;
        router.push(`/order/tracking/${data.orderId}${qs}`);
      }
    }
  });

  const handleAddToCart = (
    item: MenuItem,
    quantity: number,
    note?: string,
    modifiers?: MenuItem["modifiers"]
  ) => {
    addItem(item, quantity, note, modifiers);
  };

  const startCheckout = () => {
    // For pickup/delivery, redirect to checkout page with OTP verification
    if (orderType !== "dine_in") {
      const checkoutParams = new URLSearchParams({
        restaurantId,
        orderType,
        ...(tableId && { tableId }),
        ...(sessionId && { sessionId }),
      });
      router.push(`/order/checkout?${checkoutParams.toString()}`);
      return;
    }
    
    // For dine-in, show payment confirmation sheet
    setShowPaymentSheet(true);
  };

  const handleCustomerFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowCustomerForm(false);
    setShowPaymentSheet(true);
  };

  const orderTypeLabel = {
    dine_in: t("dineIn") || "Dine In",
    pickup: t("pickup") || "Pickup",
    delivery: t("delivery") || "Delivery",
  }[orderType];

  const orderTypeIcon = {
    dine_in: "🍽️",
    pickup: "🛍️",
    delivery: "🚗",
  }[orderType];

  return (
    <main className="min-h-screen pb-40" dir={direction}>
      <header className="p-4 sm:p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-[var(--surface)]">
        <div className="space-y-1">
          <Link
            href={`/r/${restaurant.slug || restaurant.id}`}
            className="text-xs uppercase tracking-[0.3em] text-ink-muted font-semibold hover:text-brand transition"
          >
            ← {restaurant.name}
          </Link>
          <h1 className="text-3xl font-bold">{t("menu")}</h1>
          <p className="text-sm text-ink-muted">
            {orderTypeIcon} {orderTypeLabel}
            {tableId && ` · Table ${tableId}`}
            {" · "}{menu.currency}
          </p>
        </div>
        <div className="flex gap-2">
          <ThemeToggle />
          <LanguageToggle />
        </div>
      </header>

      <CategoryTabs
        categories={menu.categories}
        activeId={activeCategory}
        onSelect={(id) => setActiveCategory(id)}
        showAll
      />

      <section className="p-4 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(activeCategory === ALL_CATEGORY_ID
            ? menu.items
            : itemsByCategory[activeCategory ?? ""] ?? []
          ).map((item) => (
            <MenuItemCard key={item.id} item={item} onSelect={setSelectedItem} />
          ))}
        </div>
      </section>

      <ItemModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onAdd={handleAddToCart}
      />

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        currency={menu.currency}
        onCheckout={startCheckout}
        onSplitPayment={orderType === "dine_in" ? () => setShowSplit(true) : undefined}
      />

      {/* Customer Info Form Modal for Pickup/Delivery */}
      {showCustomerForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h2 className="text-xl font-bold mb-4">
              {orderType === "delivery"
                ? t("deliveryDetails") || "Delivery Details"
                : t("pickupDetails") || "Pickup Details"}
            </h2>
            <form onSubmit={handleCustomerFormSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  {t("name") || "Name"} *
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-light-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder={t("yourName") || "Your name"}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  {t("phone") || "Phone"} *
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-light-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder={t("yourPhone") || "Your phone number"}
                />
              </div>
              
              {orderType === "delivery" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-ink-muted mb-1">
                      {t("deliveryAddress") || "Delivery Address"} *
                    </label>
                    <textarea
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      required
                      rows={2}
                      className="w-full px-4 py-2 border border-light-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-brand resize-none"
                      placeholder={t("fullAddress") || "Full delivery address"}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-muted mb-1">
                      {t("deliveryNotes") || "Delivery Notes"}
                    </label>
                    <input
                      type="text"
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                      className="w-full px-4 py-2 border border-light-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                      placeholder={t("deliveryNotesPlaceholder") || "Floor, apartment, etc."}
                    />
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCustomerForm(false)}
                  className="flex-1 px-4 py-3 rounded-button border border-light-divider text-ink-muted hover:bg-light-surface-2 transition"
                >
                  {t("cancel") || "Cancel"}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 rounded-button bg-brand text-white font-bold hover:bg-brand-dark transition"
                >
                  {t("continue") || "Continue"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <PaymentSheet
        open={showPaymentSheet}
        onClose={() => setShowPaymentSheet(false)}
        amount={total()}
        currency={menu.currency}
        onConfirm={() => {
          setShowPaymentSheet(false);
          mutation.mutate({});
        }}
      />

      <SplitPayment
        open={showSplit}
        lines={lines}
        currency={menu.currency}
        onClose={() => setShowSplit(false)}
        onConfirm={(ids) => {
          setShowSplit(false);
          const itemIds = lines
            .filter((line) => ids.includes(line.id))
            .map((line) => line.item.id);
          mutation.mutate({ splitByItemIds: itemIds });
        }}
      />

      {!cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-4 right-4 px-4 py-3 rounded-button bg-brand text-white font-bold shadow-lg shadow-brand/30 hover:bg-brand-dark transition"
        >
          {t("cart")} · {menu.currency} {total().toFixed(2)}
        </button>
      )}
    </main>
  );
}
