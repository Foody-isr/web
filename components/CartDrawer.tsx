"use client";

import { useCartStore } from "@/store/useCartStore";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";

type Props = {
  open: boolean;
  onClose: () => void;
  currency: string;
  onCheckout: (paymentMethod: "pay_now" | "pay_later") => void;
  onSplitPayment?: () => void;
};

export function CartDrawer({ open, onClose, currency, onCheckout, onSplitPayment }: Props) {
  const { lines, updateQuantity, removeItem, total } = useCartStore();
  const { t } = useI18n();
  const totalAmount = useMemo(() => total(), [total]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          className="fixed inset-x-0 bottom-0 z-30 px-4 pb-4"
        >
          <div className="card p-4 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold">
                {t("cart")} ({lines.length})
              </p>
              <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800">
                Close
              </button>
            </div>
            {lines.length === 0 ? (
              <p className="text-slate-500 text-sm">{t("emptyCart")}</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                {lines.map((line) => (
                  <div key={line.item.id} className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="font-semibold">{line.item.name}</p>
                      {line.note && <p className="text-xs text-slate-500 mt-1">{line.note}</p>}
                      <p className="text-sm text-slate-700">
                        {currency} {(line.item.price * line.quantity).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="w-8 h-8 rounded-full border border-slate-200"
                        onClick={() => updateQuantity(line.item.id, Math.max(0, line.quantity - 1))}
                      >
                        -
                      </button>
                      <span className="min-w-[20px] text-center font-semibold">{line.quantity}</span>
                      <button
                        className="w-8 h-8 rounded-full border border-slate-200"
                        onClick={() => updateQuantity(line.item.id, line.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                    <button
                      className="text-xs text-red-500"
                      onClick={() => removeItem(line.item.id)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">{t("orderSummary")}</p>
              <p className="text-lg font-semibold">
                {currency} {totalAmount.toFixed(2)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                className="px-4 py-3 rounded-xl bg-white border border-slate-200 font-semibold hover:border-brand"
                onClick={() => onCheckout("pay_later")}
                disabled={lines.length === 0}
              >
                {t("payLater")}
              </button>
              <button
                className="px-4 py-3 rounded-xl bg-brand text-white font-semibold shadow-lg shadow-brand/30 disabled:opacity-50"
                onClick={() => onCheckout("pay_now")}
                disabled={lines.length === 0}
              >
                {t("payNow")}
              </button>
            </div>
            {onSplitPayment && (
              <button
                className="w-full text-sm text-brand underline"
                onClick={onSplitPayment}
                disabled={lines.length === 0}
              >
                {t("splitPayment")}
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
