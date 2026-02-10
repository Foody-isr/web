"use client";

import { useCartStore } from "@/store/useCartStore";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { formatModifierLabel, lineTotal, lineUnitPrice } from "@/lib/cart";
import { useHydrated } from "@/hooks/useHydrated";
import { VAT_MULTIPLIER } from "@/lib/constants";
import Image from "next/image";

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
  const totalAmount = useMemo(() => total(), [total]);
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
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40"
            onClick={onClose}
          />
          
          {/* Full-page Cart Modal */}
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-50 bg-[var(--bg-page)] flex flex-col"
            dir={direction}
          >
            {/* Header with X button */}
            <div className="flex-shrink-0 px-4 pt-4 pb-2">
              <div className="flex items-center justify-end">
                <button
                  onClick={onClose}
                  className="w-12 h-12 rounded-full bg-[var(--surface-subtle)] flex items-center justify-center text-[var(--text)] hover:bg-[var(--surface-elevated)] transition"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Title */}
            <div className="flex-shrink-0 px-4 pb-4">
              <h1 className="text-2xl font-bold italic text-[var(--text)]">{t("yourOrder") || "Your order"}</h1>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-4">
              {displayLines.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-20 h-20 mx-auto rounded-full bg-[var(--surface-subtle)] flex items-center justify-center mb-4">
                    <svg className="w-10 h-10 text-[var(--text-soft)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  </div>
                  <p className="text-[var(--text-muted)] text-lg">{t("emptyCart")}</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {/* Cart Items */}
                  {displayLines.map((line) => (
                    <div 
                      key={line.id} 
                      className="flex items-center gap-4 py-4 border-b border-[var(--divider)]"
                    >
                      {/* Item Image */}
                      <div className="w-16 h-16 rounded-xl bg-[var(--surface-subtle)] overflow-hidden flex-shrink-0">
                        {line.item.imageUrl ? (
                          <Image
                            src={line.item.imageUrl}
                            alt={line.item.name}
                            width={64}
                            height={64}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[var(--text-soft)]">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Item Details */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[var(--text)]">{line.item.name}</p>
                        <p className="text-brand font-semibold mt-0.5">
                          {currency}{lineUnitPrice(line).toFixed(2)}
                        </p>
                        {line.modifiers && line.modifiers.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
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
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex-shrink-0">
                        <div className="flex items-center gap-0 border border-[var(--divider)] rounded-lg overflow-hidden">
                          <button
                            className="w-9 h-9 flex items-center justify-center text-brand hover:bg-[var(--surface-subtle)] transition"
                            onClick={() => updateQuantity(line.id, Math.max(0, line.quantity - 1))}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                            </svg>
                          </button>
                          <span className="min-w-[32px] text-center font-semibold text-[var(--text)]">
                            {line.quantity}
                          </span>
                          <button
                            className="w-9 h-9 flex items-center justify-center text-brand hover:bg-[var(--surface-subtle)] transition"
                            onClick={() => updateQuantity(line.id, line.quantity + 1)}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer with Checkout Button */}
            {displayLines.length > 0 && (
              <div className="flex-shrink-0 p-4 space-y-3">
                {/* Checkout button - Orange primary */}
                <button
                  className="w-full py-4 rounded-xl font-bold text-base transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between px-5 bg-brand text-white hover:bg-brand-dark"
                  style={{ boxShadow: "0 4px 20px rgba(235, 82, 4, 0.3)" }}
                  onClick={onCheckout}
                  disabled={displayLines.length === 0}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-white/20 text-white text-sm font-bold flex items-center justify-center">
                      {displayTotalItems}
                    </span>
                    <span>{t("goToCheckout") || "Go to checkout"}</span>
                  </div>
                  <span>{currency}{displayTotalAmount.toFixed(2)}</span>
                </button>

                {/* Estimated service fee */}
                <p className="text-center text-sm text-[var(--text-muted)]">
                  {t("estimatedServiceFee") || "Estimated service fee"} {currency}1.00
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
