"use client";

import { CartLine } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

type Props = {
  open: boolean;
  lines: CartLine[];
  currency: string;
  onClose: () => void;
  onConfirm: (itemIds: string[]) => void;
};

export function SplitPayment({ open, lines, currency, onClose, onConfirm }: Props) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const total = lines
    .filter((line) => selected.includes(line.item.id))
    .reduce((sum, line) => sum + line.item.price * line.quantity, 0);

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
            className="card w-full max-w-md p-6 space-y-4"
          >
            <h3 className="text-xl font-semibold">Split payment</h3>
            <p className="text-sm text-slate-600">
              Select which items this guest will pay for. This is a UI mock; hook into your PSP to
              create multiple payments.
            </p>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
              {lines.map((line) => (
                <label
                  key={line.item.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-200"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(line.item.id)}
                    onChange={() => toggle(line.item.id)}
                    className="accent-brand h-4 w-4"
                  />
                  <div className="flex-1">
                    <p className="font-medium">
                      {line.item.name} x{line.quantity}
                    </p>
                    <p className="text-sm text-slate-600">
                      {currency} {(line.item.price * line.quantity).toFixed(2)}
                    </p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Selected total</p>
              <p className="text-lg font-semibold">
                {currency} {total.toFixed(2)}
              </p>
            </div>
            <div className="flex gap-3">
              <button className="flex-1 px-4 py-3 rounded-xl border" onClick={onClose}>
                Cancel
              </button>
              <button
                className="flex-1 px-4 py-3 rounded-xl bg-brand text-white font-semibold disabled:opacity-50"
                onClick={() => onConfirm(selected)}
                disabled={selected.length === 0}
              >
                Confirm
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
