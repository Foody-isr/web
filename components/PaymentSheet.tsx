"use client";

import { AnimatePresence, motion } from "framer-motion";

type Props = {
  open: boolean;
  onClose: () => void;
  amount: number;
  currency: string;
  onConfirm: () => void;
};

export function PaymentSheet({ open, onClose, amount, currency, onConfirm }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            className="card w-full max-w-md p-6"
          >
            <h3 className="text-xl font-bold mb-4">Payment</h3>
            <p className="text-ink-muted text-sm">
              Stripe or gateway goes here. We mock a checkout so you can plug in your provider later.
            </p>
            <div className="mt-4 rounded-card border border-dashed border-light-divider p-4 bg-light-subtle">
              <p className="text-sm text-ink-muted">Amount</p>
              <p className="text-2xl font-bold text-brand">
                {currency} {amount.toFixed(2)}
              </p>
            </div>
            <div className="mt-6 space-y-3">
              <button
                className="w-full px-4 py-3 rounded-button bg-brand text-white font-bold shadow-lg shadow-brand/30 hover:bg-brand-dark transition"
                onClick={onConfirm}
              >
                Continue to checkout
              </button>
              <button
                className="w-full px-4 py-3 rounded-button border border-light-divider bg-light-surface hover:border-brand transition"
                onClick={onClose}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
