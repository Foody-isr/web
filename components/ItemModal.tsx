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
  const { t } = useI18n();
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
            className="bg-[var(--surface)] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-black/5"
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
                <p className="text-sm text-ink/70 mt-1">{item.description}</p>
              </div>
              <div className="flex gap-3 items-center">
                <div className="flex items-center gap-3 bg-ink/5 rounded-full px-3 py-2">
                  <button
                    className="w-8 h-8 rounded-full bg-white shadow border border-black/10"
                    onClick={() => setQty(Math.max(1, qty - 1))}
                  >
                    -
                  </button>
                  <span className="font-semibold min-w-[24px] text-center">{qty}</span>
                  <button
                    className="w-8 h-8 rounded-full bg-white shadow border border-black/10"
                    onClick={() => setQty(qty + 1)}
                  >
                    +
                  </button>
                </div>
                <p className="text-lg font-semibold">${unitPrice.toFixed(2)}</p>
              </div>
              {activeModifiers.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-ink">{t("modifiers") ?? "Modifiers"}</p>
                    {pickedModifiers.length > 0 && (
                      <p className="text-xs text-ink/60">
                        {pickedModifiers.length} selected
                      </p>
                    )}
                  </div>
                  <div className="space-y-3">
                    {Object.entries(groupedModifiers).map(([group, modifiers]) => (
                      <div key={group} className="rounded-2xl border border-black/10 bg-white/70">
                        <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink/60">
                          {group}
                        </div>
                        <div className="divide-y divide-black/5">
                          {modifiers.map((modifier) => {
                            const checked = !!selectedModifiers[modifier.id];
                            const delta = modifier.priceDelta ?? 0;
                            const deltaLabel =
                              delta === 0 ? "" : `${delta > 0 ? "+" : ""}$${delta.toFixed(2)}`;
                            return (
                              <label
                                key={modifier.id}
                                className="flex items-center gap-3 px-4 py-3 text-sm"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleModifier(modifier.id)}
                                  className="accent-brand h-4 w-4"
                                />
                                <div className="flex-1">
                                  <p className="font-medium">
                                    {formatModifierLabel(modifier)}
                                  </p>
                                  {modifier.action === "remove" && (
                                    <p className="text-xs text-ink/50">Remove from recipe</p>
                                  )}
                                </div>
                                {deltaLabel && (
                                  <span className="text-xs font-semibold text-ink/70">
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
              <div className="space-y-2">
                <label className="text-sm font-medium text-ink/70">{t("notes")}</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full rounded-xl border border-black/10 p-3 focus:outline-none focus:ring-2 focus:ring-brand bg-white/80"
                  placeholder="No onions, sauce on the side..."
                  rows={2}
                />
              </div>
            </div>
            <div className="p-5 bg-[var(--surface-subtle)] flex items-center gap-3">
              <button
                onClick={() => {
                  onAdd(item, qty, note, pickedModifiers);
                  onClose();
                }}
                className="flex-1 px-4 py-3 rounded-xl bg-brand text-white font-semibold shadow-brand/30 shadow-lg"
              >
                {t("addToCart")} · ${(unitPrice * qty).toFixed(2)}
              </button>
              <button onClick={onClose} className="px-4 py-3 rounded-xl bg-white border border-black/10">
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
