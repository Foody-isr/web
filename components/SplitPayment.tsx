"use client";

import { CartLine } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { formatModifierLabel, lineTotal, lineUnitPrice } from "@/lib/cart";

type Props = {
  open: boolean;
  lines: CartLine[];
  currency: string;
  onClose: () => void;
  onConfirm: (lineIds: string[]) => void;
};

export function SplitPayment({ open, lines, currency, onClose, onConfirm }: Props) {
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      setSelected([]);
    }
  }, [open]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const total = lines
    .filter((line) => selected.includes(line.id))
    .reduce((sum, line) => sum + lineTotal(line), 0);

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
            className="card w-full max-w-md p-6 space-y-4 border border-black/5"
          >
            <h3 className="text-xl font-semibold">Split payment</h3>
            <p className="text-sm text-ink/60">
              Select which items this guest will pay for. This is a UI mock; hook into your PSP to
              create multiple payments.
            </p>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
              {lines.map((line) => (
                <label
                  key={line.id}
                  className="flex items-start gap-3 p-3 rounded-xl border border-black/10 bg-white/80"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(line.id)}
                    onChange={() => toggle(line.id)}
                    className="accent-brand h-4 w-4"
                  />
                  <div className="flex-1">
                    <p className="font-medium">
                      {line.item.name} x{line.quantity}
                    </p>
                    {line.modifiers && line.modifiers.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {line.modifiers.map((modifier) => (
                          <span
                            key={modifier.id}
                            className="text-[11px] font-medium px-2 py-1 rounded-full bg-ink/5 text-ink/70"
                          >
                            {formatModifierLabel(modifier)}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-sm text-ink/60">
                      {currency} {lineUnitPrice(line).toFixed(2)} ·{" "}
                      {currency} {lineTotal(line).toFixed(2)}
                    </p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-ink/60">Selected total</p>
              <p className="text-lg font-semibold">
                {currency} {total.toFixed(2)}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                className="flex-1 px-4 py-3 rounded-xl border border-black/10 bg-white/80"
                onClick={onClose}
              >
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
