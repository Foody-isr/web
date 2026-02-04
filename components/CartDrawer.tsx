"use client";

import { useCartStore } from "@/store/useCartStore";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { formatModifierLabel, lineTotal, lineUnitPrice } from "@/lib/cart";
import { useHydrated } from "@/hooks/useHydrated";

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
  const hydrated = useHydrated();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- lines dependency needed to trigger recalc on cart changes
  const totalAmount = useMemo(() => total(), [lines, total]);
  const totalItems = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity, 0),
    [lines]
  );
  const displayLines = hydrated ? lines : [];
  const displayTotalAmount = hydrated ? totalAmount : 0;
  const displayTotalItems = hydrated ? totalItems : 0;

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
              <p className="text-lg font-bold">
                {t("cart")} ({displayTotalItems})
              </p>
              <button onClick={onClose} className="text-sm text-ink-muted hover:text-ink">
                Close
              </button>
            </div>
            {displayLines.length === 0 ? (
              <p className="text-ink-muted text-sm">{t("emptyCart")}</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                {displayLines.map((line) => (
                  <div key={line.id} className="flex items-start gap-3">
                    <div className="flex-1">
                      <p className="font-semibold">{line.item.name}</p>
                      {line.modifiers && line.modifiers.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-2">
                          {line.modifiers.map((modifier) => (
                            <span
                              key={modifier.id}
                              className="text-[11px] font-medium px-2 py-1 rounded-chip bg-light-subtle text-ink-muted"
                            >
                              {formatModifierLabel(modifier)}
                            </span>
                          ))}
                        </div>
                      )}
                      {line.note && <p className="text-xs text-ink-muted mt-1">{line.note}</p>}
                      <p className="text-sm text-ink-muted">
                        {currency} {lineUnitPrice(line).toFixed(2)} × {line.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="w-8 h-8 rounded-button border border-light-divider hover:border-brand"
                        onClick={() => updateQuantity(line.id, Math.max(0, line.quantity - 1))}
                      >
                        -
                      </button>
                      <span className="min-w-[20px] text-center font-semibold">{line.quantity}</span>
                      <button
                        className="w-8 h-8 rounded-button border border-light-divider hover:border-brand"
                        onClick={() => updateQuantity(line.id, line.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                    <button
                      className="text-xs text-accent-red hover:underline"
                      onClick={() => removeItem(line.id)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between">
              <p className="text-sm text-ink-muted">{t("orderSummary")}</p>
              <p className="text-lg font-bold">
                {currency} {displayTotalAmount.toFixed(2)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                className="px-4 py-3 rounded-button bg-light-surface border border-light-divider font-semibold hover:border-brand transition"
                onClick={() => onCheckout("pay_later")}
                disabled={displayLines.length === 0}
              >
                {t("payLater")}
              </button>
              <button
                className="px-4 py-3 rounded-button bg-brand text-white font-bold shadow-lg shadow-brand/30 disabled:opacity-50 hover:bg-brand-dark transition"
                onClick={() => onCheckout("pay_now")}
                disabled={displayLines.length === 0}
              >
                {t("payNow")}
              </button>
            </div>
            {onSplitPayment && (
              <button
                className="w-full text-sm text-brand hover:underline font-medium"
                onClick={onSplitPayment}
                disabled={displayLines.length === 0}
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
