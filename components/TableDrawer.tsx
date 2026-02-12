"use client";

import { useI18n } from "@/lib/i18n";
import { useTableSession } from "@/store/useTableSession";
import { MenuItem } from "@/lib/types";
import { CURRENCY_SYMBOL } from "@/lib/constants";

type Props = {
  open: boolean;
  onClose: () => void;
  onLeaveTable: () => void;
  onPayNow?: () => void;
  showPayButton?: boolean;
  menuItems?: MenuItem[];
};

export function TableDrawer({ open, onClose, onLeaveTable, onPayNow, showPayButton, menuItems }: Props) {
  const { t, direction } = useI18n();
  const tableCode = useTableSession((s) => s.tableCode);

  // Build a lookup map for menu item names
  const menuItemMap = new Map(menuItems?.map((mi) => [Number(mi.id), mi.name]) ?? []);
  const guests = useTableSession((s) => s.guests);
  const orders = useTableSession((s) => s.orders);
  const guestId = useTableSession((s) => s.guestId);
  const totalTableAmount = useTableSession((s) => s.totalTableAmount);

  if (!open) return null;

  const tableTotal = totalTableAmount();

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[91] bg-[var(--surface)] rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300"
        dir={direction}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[var(--divider)]" />
        </div>

        {/* Header */}
        <div className="px-5 pb-4 pt-2 border-b border-[var(--divider)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                🪑 {t("table") || "Table"} {tableCode}
              </h2>
              <p className="text-sm text-[var(--text-soft)] mt-0.5">
                {guests.length} {guests.length === 1 ? (t("guest") || "guest") : (t("guests") || "guests")}
                {orders.length > 0 && ` · ${orders.length} ${orders.length === 1 ? (t("order") || "order") : (t("orders") || "orders")}`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[var(--surface-subtle)] flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-6">
          {/* Guests section */}
          <section>
            <h3 className="text-sm font-semibold text-[var(--text-soft)] uppercase tracking-wider mb-3 flex items-center gap-2">
              <span>👥</span> {t("whosHere") || "Who's here"}
            </h3>
            <div className="flex flex-wrap gap-2">
              {guests.map((g) => (
                <div
                  key={g.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all ${
                    g.id === guestId
                      ? "bg-brand/10 border border-brand/30 font-semibold"
                      : "bg-[var(--surface-subtle)] border border-transparent"
                  }`}
                >
                  <span className="text-lg">{g.avatar_emoji}</span>
                  <span className="text-[var(--text-primary)]">
                    {g.display_name}
                    {g.id === guestId && (
                      <span className="text-xs text-brand ms-1">({t("you") || "you"})</span>
                    )}
                  </span>
                </div>
              ))}
              {guests.length === 0 && (
                <p className="text-sm text-[var(--text-muted)]">{t("noGuestsYet") || "No guests yet"}</p>
              )}
            </div>
          </section>

          {/* Orders section — consolidated items view */}
          <section>
            <h3 className="text-sm font-semibold text-[var(--text-soft)] uppercase tracking-wider mb-3 flex items-center gap-2">
              <span>📋</span> {t("tableOrders") || "Table orders"}
            </h3>

            {orders.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">🍽️</div>
                <p className="text-[var(--text-muted)]">{t("noOrdersYet") || "No orders yet"}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">{t("startOrdering") || "Start browsing the menu to place an order!"}</p>
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--divider)] bg-[var(--surface-subtle)] overflow-hidden">
                {/* All items from all orders, grouped as a single receipt */}
                <div className="divide-y divide-[var(--divider)]">
                  {orders.flatMap((order) => {
                    const orderGuest = guests.find((g) => g.id === order.guest_id);
                    const guestName = order.guest_name || order.customer_name || t("unknown") || "Unknown";
                    const isMyOrder = order.guest_id === guestId;

                    return (order.items || []).map((item) => (
                      <div key={`${order.id}-${item.id}`} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-sm text-[var(--text-primary)]">
                                {item.quantity}×
                              </span>
                              <span className="text-sm text-[var(--text-primary)] truncate">
                                {menuItemMap.get(item.menu_item_id) || `Item #${item.menu_item_id}`}
                              </span>
                            </div>
                            {/* Modifiers */}
                            {item.modifiers && item.modifiers.length > 0 && (
                              <div className="mt-0.5 ms-5">
                                {item.modifiers.map((mod, idx) => (
                                  <span key={idx} className="text-xs text-[var(--text-muted)] block">
                                    {mod.action === "add" ? "+" : "−"} {mod.name}
                                    {mod.price_delta > 0 && ` (+${CURRENCY_SYMBOL}${mod.price_delta.toFixed(2)})`}
                                  </span>
                                ))}
                              </div>
                            )}
                            {/* Who ordered */}
                            <div className="flex items-center gap-1 mt-1 ms-5">
                              <span className="text-xs">{orderGuest?.avatar_emoji || "🍽️"}</span>
                              <span className="text-xs text-[var(--text-muted)]">
                                {guestName}
                                {isMyOrder && <span className="text-brand ms-0.5">({t("you") || "you"})</span>}
                              </span>
                            </div>
                          </div>
                          <span className="text-sm font-semibold text-[var(--text-primary)] whitespace-nowrap">
                            {CURRENCY_SYMBOL}{(item.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ));
                  })}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Footer with table total */}
        {orders.length > 0 && (
          <div className="px-5 py-4 border-t border-[var(--divider)] bg-[var(--surface)]">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-soft)]">{t("tableTotal") || "Table total"}</span>
              <span className="text-xl font-bold text-[var(--text-primary)]">
                {CURRENCY_SYMBOL}{tableTotal.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Pay Now button — shown when restaurant allows post-meal payment */}
        {showPayButton && orders.length > 0 && guestId && onPayNow && (
          <div className="px-5 py-3 border-t border-[var(--divider)] bg-[var(--surface)]">
            <button
              onClick={onPayNow}
              className="w-full py-3 rounded-xl bg-brand text-white font-bold shadow-lg shadow-brand/30 hover:bg-brand-dark transition"
            >
              💳 {t("payForTable") || "Pay now"} · {CURRENCY_SYMBOL}{tableTotal.toFixed(2)}
            </button>
          </div>
        )}

        {/* Leave table button */}
        {guestId && (
          <div className="px-5 py-3 border-t border-[var(--divider)] bg-[var(--surface)]">
            <button
              onClick={onLeaveTable}
              className="w-full py-2.5 text-sm font-medium text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            >
              {t("leaveTable") || "Leave table"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
