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
            className="card w-full max-w-md p-6 border border-black/5"
          >
            <h3 className="text-xl font-semibold mb-4">Payment</h3>
            <p className="text-ink/60 text-sm">
              Stripe or gateway goes here. We mock a checkout so you can plug in your provider later.
            </p>
            <div className="mt-4 rounded-xl border border-dashed border-black/10 p-4 bg-white/80">
              <p className="text-sm text-ink/60">Amount</p>
              <p className="text-2xl font-semibold">
                {currency} {amount.toFixed(2)}
              </p>
            </div>
            <div className="mt-6 space-y-3">
              <button
                className="w-full px-4 py-3 rounded-xl bg-brand text-white font-semibold shadow-lg shadow-brand/30"
                onClick={onConfirm}
              >
                Continue to checkout
              </button>
              <button
                className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white/80"
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
