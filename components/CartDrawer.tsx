"use client";

import { useCartStore } from "@/store/useCartStore";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { formatModifierLabel, lineTotal, lineUnitPrice } from "@/lib/cart";
import { useHydrated } from "@/hooks/useHydrated";
import { VAT_MULTIPLIER } from "@/lib/constants";

type Props = {
  open: boolean;
  onClose: () => void;
  currency: string;
  onCheckout: () => void;
  onSplitPayment?: () => void;
};

export function CartDrawer({ open, onClose, currency, onCheckout, onSplitPayment }: Props) {
  const { lines, updateQuantity, removeItem, total } = useCartStore();
  const { t, direction } = useI18n();
  const hydrated = useHydrated();
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
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed inset-x-0 bottom-0 z-30 p-4 sm:p-6"
          dir={direction}
        >
          <div className="max-w-lg mx-auto bg-[var(--surface)] rounded-2xl shadow-2xl overflow-hidden border border-[var(--divider)]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--divider)] bg-[var(--surface-subtle)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-[var(--text)]">
                    {t("cart")}
                  </p>
                  <p className="text-sm text-[var(--text-muted)]">
                    {displayTotalItems} {t("items")}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-[var(--surface)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-elevated)] transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Cart Items */}
            <div className="px-5 py-4 max-h-64 overflow-y-auto scrollbar-thin">
              {displayLines.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto rounded-full bg-[var(--surface-subtle)] flex items-center justify-center mb-3">
                    <svg className="w-8 h-8 text-[var(--text-soft)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  </div>
                  <p className="text-[var(--text-muted)]">{t("emptyCart")}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {displayLines.map((line) => (
                    <div key={line.id} className="flex items-start gap-3 group">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[var(--text)] truncate">{line.item.name}</p>
                        {line.modifiers && line.modifiers.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {line.modifiers.map((modifier) => (
                              <span
                                key={modifier.id}
                                className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--surface-subtle)] text-[var(--text-muted)]"
                              >
                                {formatModifierLabel(modifier)}
                              </span>
                            ))}
                          </div>
                        )}
                        {line.note && (
                          <p className="text-xs text-[var(--text-muted)] mt-1 italic">&quot;{line.note}&quot;</p>
                        )}
                        <p className="text-sm text-[var(--text-muted)] mt-1">
                          {currency} {lineUnitPrice(line).toFixed(2)} × {line.quantity}
                        </p>
                      </div>
                      
                      {/* Quantity controls */}
                      <div className="flex items-center gap-1 bg-[var(--surface-subtle)] rounded-lg p-1">
                        <button
                          className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)] transition"
                          onClick={() => updateQuantity(line.id, Math.max(0, line.quantity - 1))}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                          </svg>
                        </button>
                        <span className="min-w-[24px] text-center font-semibold text-sm text-[var(--text)]">
                          {line.quantity}
                        </span>
                        <button
                          className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)] transition"
                          onClick={() => updateQuantity(line.id, line.quantity + 1)}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      </div>

                      {/* Remove button */}
                      <button
                        className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-md flex items-center justify-center text-accent-red hover:bg-accent-red/10 transition"
                        onClick={() => removeItem(line.id)}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer with totals and checkout */}
            {displayLines.length > 0 && (
              <div className="px-5 py-4 border-t border-[var(--divider)] bg-[var(--surface-subtle)] space-y-3">
                {/* VAT Breakdown */}
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center justify-between text-[var(--text-muted)]">
                    <span>{t("subtotal")}</span>
                    <span>{currency} {(displayTotalAmount / VAT_MULTIPLIER).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[var(--text-muted)]">
                    <span>{t("vat")} (18%)</span>
                    <span>{currency} {(displayTotalAmount - displayTotalAmount / VAT_MULTIPLIER).toFixed(2)}</span>
                  </div>
                </div>
                
                {/* Total */}
                <div className="flex items-center justify-between pt-2 border-t border-[var(--divider)]">
                  <p className="font-bold text-[var(--text)]">{t("total")}</p>
                  <p className="text-xl font-bold price">
                    {currency} {displayTotalAmount.toFixed(2)}
                  </p>
                </div>

                {/* Checkout button */}
                <button
                  className="w-full py-3.5 rounded-xl bg-brand text-white font-bold text-base shadow-lg hover:bg-brand-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ boxShadow: "0 4px 20px rgba(235, 82, 4, 0.3)" }}
                  onClick={onCheckout}
                  disabled={displayLines.length === 0}
                >
                  {t("checkout")} · {currency} {displayTotalAmount.toFixed(2)}
                </button>

                {/* Split payment option */}
                {onSplitPayment && (
                  <button
                    className="w-full text-sm text-brand hover:underline font-medium py-2"
                    onClick={onSplitPayment}
                    disabled={displayLines.length === 0}
                  >
                    {t("splitPayment")}
                  </button>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
