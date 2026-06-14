"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { currencySymbol } from "@/lib/constants";
import { fetchMyOrders, GuestOrder } from "@/services/api";

/**
 * Bottom-sheet listing the signed-in guest's past orders, each with a one-tap
 * "Reorder" that hands the order back to the parent to add to the cart.
 */
export function OrderHistorySheet({
  open,
  onClose,
  restaurantId,
  currency,
  onReorder,
}: {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
  currency: string;
  onReorder: (order: GuestOrder) => void;
}) {
  const { t, direction } = useI18n();
  const sym = currencySymbol(currency);
  const [orders, setOrders] = useState<GuestOrder[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setOrders(null);
    fetchMyOrders(restaurantId)
      .then(setOrders)
      .catch(() => setOrders([]));
  }, [open, restaurantId]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center"
      dir={direction}
    >
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full sm:max-w-[420px] max-h-[80vh] bg-white rounded-t-[24px] sm:rounded-[24px] shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
          <h2 className="font-bold text-[15px] text-slate-900">{t("accountMyOrders") || "My orders"}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto p-3 space-y-2">
          {orders === null && (
            <div className="py-12 text-center text-slate-400 text-sm">…</div>
          )}
          {orders?.length === 0 && (
            <div className="py-12 text-center text-slate-500 text-sm">
              {t("reorderEmpty") || "You don't have any past orders here yet."}
            </div>
          )}
          {orders?.map((o) => (
            <div key={o.id} className="rounded-2xl ring-1 ring-slate-100 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-800">
                  {(t("accountOrderOn") || "Order of {date}").replace(
                    "{date}",
                    new Date(o.created_at).toLocaleDateString()
                  )}
                </div>
                <div className="text-sm font-extrabold" style={{ color: "var(--brand)" }}>
                  {sym}
                  {o.total.toFixed(2)}
                </div>
              </div>
              <div className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                {o.items.map((it) => `${it.quantity}× ${it.combo_name || it.name}`).join(", ")}
              </div>
              <button
                onClick={() => onReorder(o)}
                className="mt-2.5 w-full py-2 rounded-full text-white text-sm font-semibold shadow-sm active:scale-[0.99] transition"
                style={{ backgroundColor: "var(--brand)" }}
              >
                {t("reorder") || "Reorder"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
