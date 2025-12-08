"use client";

import { CategoryTabs } from "@/components/CategoryTabs";
import { CartDrawer } from "@/components/CartDrawer";
import { ItemModal } from "@/components/ItemModal";
import { LanguageToggle } from "@/components/LanguageToggle";
import { MenuItemCard } from "@/components/MenuItemCard";
import { PaymentSheet } from "@/components/PaymentSheet";
import { SplitPayment } from "@/components/SplitPayment";
import { useI18n } from "@/lib/i18n";
import { MenuItem, MenuResponse, OrderPayload } from "@/lib/types";
import { useCartStore } from "@/store/useCartStore";
import { createOrder } from "@/services/api";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Props = {
  menu: MenuResponse;
  restaurantId: string;
  tableId: string;
  sessionId?: string;
};

export function MenuExperience({ menu, restaurantId, tableId, sessionId }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const setContext = useCartStore((s) => s.setContext);
  const addItem = useCartStore((s) => s.addItem);
  const lines = useCartStore((s) => s.lines);
  const total = useCartStore((s) => s.total);

  useEffect(() => {
    setContext(restaurantId, menu.currency);
  }, [restaurantId, menu.currency, setContext]);

  const [activeCategory, setActiveCategory] = useState(menu.categories[0]?.id);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [cartOpen, setCartOpen] = useState(true);
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [showSplit, setShowSplit] = useState(false);

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
      paymentMethod,
      splitByItemIds
    }: {
      paymentMethod: "pay_now" | "pay_later";
      splitByItemIds?: string[];
    }) => {
      const payload: OrderPayload = {
        restaurantId,
        tableId,
        sessionId,
        items: lines.map((line) => ({
          itemId: line.item.id,
          quantity: line.quantity,
          note: line.note
        })),
        paymentMethod,
        splitByItemIds
      };
      return createOrder(payload);
    },
    onSuccess: (data) => {
      useCartStore.getState().clear();
      const qs = `?restaurantId=${restaurantId}${tableId ? `&tableId=${tableId}` : ""}`;
      router.push(`/order/tracking/${data.orderId}${qs}`);
    }
  });

  const handleAddToCart = (item: MenuItem, quantity: number, note?: string) => {
    addItem(item, quantity, note);
  };

  const startCheckout = (method: "pay_now" | "pay_later") => {
    if (method === "pay_now") {
      setShowPaymentSheet(true);
      return;
    }
    mutation.mutate({ paymentMethod: "pay_later" });
  };

  return (
    <main className="min-h-screen pb-36">
      <header className="p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{menu.restaurantName}</p>
          <h1 className="text-2xl font-semibold">{t("menu")}</h1>
          <p className="text-sm text-slate-500">
            Table {tableId} · {menu.currency}
          </p>
        </div>
        <LanguageToggle />
      </header>

      <CategoryTabs
        categories={menu.categories}
        activeId={activeCategory}
        onSelect={(id) => setActiveCategory(id)}
      />

      <section className="p-4 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(itemsByCategory[activeCategory ?? ""] ?? []).map((item) => (
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
        onSplitPayment={() => setShowSplit(true)}
      />

      <PaymentSheet
        open={showPaymentSheet}
        onClose={() => setShowPaymentSheet(false)}
        amount={total()}
        currency={menu.currency}
        onConfirm={() => {
          setShowPaymentSheet(false);
          mutation.mutate({ paymentMethod: "pay_now" });
        }}
      />

      <SplitPayment
        open={showSplit}
        lines={lines}
        currency={menu.currency}
        onClose={() => setShowSplit(false)}
        onConfirm={(ids) => {
          setShowSplit(false);
          mutation.mutate({ paymentMethod: "pay_now", splitByItemIds: ids });
        }}
      />

      {!cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-4 right-4 px-4 py-3 rounded-full bg-brand text-white shadow-lg shadow-brand/30"
        >
          {t("cart")} · {menu.currency} {total().toFixed(2)}
        </button>
      )}
    </main>
  );
}
