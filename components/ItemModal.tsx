"use client";

import { MenuItem } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

type Props = {
  item?: MenuItem | null;
  onClose: () => void;
  onAdd: (item: MenuItem, quantity: number, note?: string) => void;
};

export function ItemModal({ item, onClose, onAdd }: Props) {
  const { t } = useI18n();
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (item) {
      setQty(1);
      setNote("");
    }
  }, [item]);

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            layout
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
          >
            <div className="relative h-56 w-full">
              <Image
                src={
                  item.imageUrl ||
                  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80"
                }
                alt={item.name}
                fill
                className="object-cover"
                sizes="500px"
              />
            </div>
            <div className="p-5 space-y-4">
              <div>
                <h3 className="text-2xl font-semibold">{item.name}</h3>
                <p className="text-slate-600 mt-1">{item.description}</p>
              </div>
              <div className="flex gap-3 items-center">
                <div className="flex items-center gap-3 bg-slate-100 rounded-full px-3 py-2">
                  <button
                    className="w-8 h-8 rounded-full bg-white shadow border border-slate-200"
                    onClick={() => setQty(Math.max(1, qty - 1))}
                  >
                    -
                  </button>
                  <span className="font-semibold min-w-[24px] text-center">{qty}</span>
                  <button
                    className="w-8 h-8 rounded-full bg-white shadow border border-slate-200"
                    onClick={() => setQty(qty + 1)}
                  >
                    +
                  </button>
                </div>
                <p className="text-lg font-semibold">${item.price.toFixed(2)}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">{t("notes")}</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="No onions, sauce on the side..."
                  rows={2}
                />
              </div>
            </div>
            <div className="p-5 bg-slate-50 flex items-center gap-3">
              <button
                onClick={() => {
                  onAdd(item, qty, note);
                  onClose();
                }}
                className="flex-1 px-4 py-3 rounded-xl bg-brand text-white font-semibold shadow-brand/30 shadow-lg"
              >
                {t("addToCart")} · ${(item.price * qty).toFixed(2)}
              </button>
              <button onClick={onClose} className="px-4 py-3 rounded-xl bg-white border">
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
