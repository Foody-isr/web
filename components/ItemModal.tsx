"use client";

import { MenuItem, MenuItemModifier } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { formatModifierLabel, modifiersDelta } from "@/lib/cart";

type Props = {
  item?: MenuItem | null;
  onClose: () => void;
  onAdd: (item: MenuItem, quantity: number, note?: string, modifiers?: MenuItemModifier[]) => void;
};

export function ItemModal({ item, onClose, onAdd }: Props) {
  const { t, direction } = useI18n();
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (item) {
      setQty(1);
      setNote("");
      setSelectedModifiers({});
    }
  }, [item]);

  const activeModifiers = useMemo(
    () => (item?.modifiers ?? []).filter((modifier) => modifier.isActive !== false),
    [item]
  );

  const groupedModifiers = useMemo(() => {
    return activeModifiers.reduce<Record<string, MenuItemModifier[]>>((acc, modifier) => {
      const key = modifier.category?.trim() || "Modifiers";
      acc[key] = acc[key] ? [...acc[key], modifier] : [modifier];
      return acc;
    }, {});
  }, [activeModifiers]);

  const pickedModifiers = useMemo(
    () => activeModifiers.filter((modifier) => selectedModifiers[modifier.id]),
    [activeModifiers, selectedModifiers]
  );

  const modifiersTotal = useMemo(() => modifiersDelta(pickedModifiers), [pickedModifiers]);
  const unitPrice = useMemo(() => (item ? item.price + modifiersTotal : 0), [item, modifiersTotal]);

  const toggleModifier = (id: string) => {
    setSelectedModifiers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            layout
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[var(--surface)] w-full max-w-lg sm:rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
            dir={direction}
          >
            {/* Image */}
            <div className="relative h-56 sm:h-64 w-full flex-shrink-0">
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
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 rtl:right-auto rtl:left-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Header */}
              <div>
                <h3 className="text-2xl font-bold text-[var(--text)]">{item.name}</h3>
                {item.description && (
                  <p className="text-sm text-[var(--text-muted)] mt-2 leading-relaxed">{item.description}</p>
                )}
              </div>
              
              {/* Price and Quantity */}
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold price">₪{unitPrice.toFixed(2)}</p>
                <div className="flex items-center gap-1 bg-[var(--surface-subtle)] rounded-xl p-1">
                  <button
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)] transition font-bold text-xl"
                    onClick={() => setQty(Math.max(1, qty - 1))}
                  >
                    −
                  </button>
                  <span className="font-bold min-w-[40px] text-center text-lg text-[var(--text)]">{qty}</span>
                  <button
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)] transition font-bold text-xl"
                    onClick={() => setQty(qty + 1)}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Modifiers */}
              {activeModifiers.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-[var(--text)]">{t("modifiers") ?? "Customize"}</p>
                    {pickedModifiers.length > 0 && (
                      <span className="text-sm text-[var(--text-muted)]">
                        {pickedModifiers.length} {t("selected") || "selected"}
                      </span>
                    )}
                  </div>
                  <div className="space-y-3">
                    {Object.entries(groupedModifiers).map(([group, modifiers]) => (
                      <div key={group} className="rounded-xl bg-[var(--surface-subtle)] overflow-hidden">
                        <div className="px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] border-b border-[var(--divider)]">
                          {group}
                        </div>
                        <div className="divide-y divide-[var(--divider)]">
                          {modifiers.map((modifier) => {
                            const checked = !!selectedModifiers[modifier.id];
                            const delta = modifier.priceDelta ?? 0;
                            const deltaLabel =
                              delta === 0 ? "" : `${delta > 0 ? "+" : ""}₪${delta.toFixed(2)}`;
                            return (
                              <label
                                key={modifier.id}
                                className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-[var(--surface)] transition"
                              >
                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition ${checked ? "bg-brand border-brand" : "border-[var(--divider)]"}`}>
                                  {checked && (
                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleModifier(modifier.id)}
                                  className="sr-only"
                                />
                                <div className="flex-1">
                                  <p className="font-medium text-[var(--text)]">
                                    {formatModifierLabel(modifier)}
                                  </p>
                                  {modifier.action === "remove" && (
                                    <p className="text-xs text-[var(--text-muted)]">{t("removeFromRecipe") || "Remove from recipe"}</p>
                                  )}
                                </div>
                                {deltaLabel && (
                                  <span className="text-sm font-semibold text-[var(--text-muted)]">
                                    {deltaLabel}
                                  </span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--text-muted)]">{t("notes") || "Special instructions"}</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="input resize-none"
                  placeholder={t("notesPlaceholder") || "No onions, sauce on the side..."}
                  rows={2}
                />
              </div>
            </div>
            
            {/* Footer - Add to cart button */}
            <div className="flex-shrink-0 p-5 bg-[var(--surface-subtle)] border-t border-[var(--divider)]">
              <button
                onClick={() => {
                  onAdd(item, qty, note, pickedModifiers);
                  onClose();
                }}
                className="w-full py-4 rounded-xl bg-brand text-white font-bold text-lg shadow-lg hover:bg-brand-dark transition"
                style={{ boxShadow: "0 4px 20px rgba(235, 82, 4, 0.3)" }}
              >
                {t("addToCart")} · ₪{(unitPrice * qty).toFixed(2)}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
