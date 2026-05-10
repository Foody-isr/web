"use client";

import { MenuItem, MenuItemModifier, OptionSetType } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { tField } from "@/lib/translations";
import { formatModifierLabel, modifiersDelta } from "@/lib/cart";

type Props = {
  item?: MenuItem | null;
  onClose: () => void;
  onAdd: (item: MenuItem, quantity: number, note?: string, modifiers?: MenuItemModifier[], selectedVariantId?: number, selectedVariantName?: string, selectedVariantPrice?: number) => void;
};

export function ItemModal({ item, onClose, onAdd }: Props) {
  const { t, direction, locale } = useI18n();
  const itemName = item ? tField(item, "name", locale) : "";
  const itemDescription = item ? tField(item, "description", locale) : "";
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, boolean>>({});
  // Variant state: maps groupId → selected variantId. First variant is default (Square behavior).
  const [selectedVariants, setSelectedVariants] = useState<Record<number, number>>({});

  useEffect(() => {
    if (item) {
      setQty(1);
      setNote("");
      setSelectedModifiers({});
      // Auto-select first option of each option set as default (Square behavior)
      const defaults: Record<number, number> = {};
      for (const os of item.optionSets ?? []) {
        if (os.options.length > 0) {
          defaults[os.id] = os.options[0].id;
        }
      }
      setSelectedVariants(defaults);
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

  // If an option is selected, use its price instead of base item price.
  const optionBasePrice = useMemo(() => {
    if (!item) return 0;
    for (const os of item.optionSets ?? []) {
      const selId = selectedVariants[os.id];
      const option = os.options.find((o) => o.id === selId);
      if (option) return option.onlinePrice ?? option.price;
    }
    return item.price;
  }, [item, selectedVariants]);

  const unitPrice = useMemo(() => optionBasePrice + modifiersTotal, [optionBasePrice, modifiersTotal]);

  // Resolve the selected option for the order payload
  const resolvedVariant = useMemo(() => {
    if (!item) return undefined;
    for (const os of item.optionSets ?? []) {
      const selId = selectedVariants[os.id];
      const option = os.options.find((o) => o.id === selId);
      if (option) return { id: option.id, name: option.name, price: option.onlinePrice ?? option.price };
    }
    return undefined;
  }, [item, selectedVariants]);

  // Determine which modifier groups are required (if any modifier in the group has isRequired)
  const requiredGroups = useMemo(() => {
    const groups = new Set<string>();
    for (const [group, modifiers] of Object.entries(groupedModifiers)) {
      if (modifiers.some((m) => m.isRequired)) {
        groups.add(group);
      }
    }
    return groups;
  }, [groupedModifiers]);

  // Check if all required groups have at least one selection
  const missingRequiredGroups = useMemo(() => {
    const missing: string[] = [];
    for (const group of requiredGroups) {
      const groupMods = groupedModifiers[group] || [];
      const hasSelection = groupMods.some((m) => selectedModifiers[m.id]);
      if (!hasSelection) missing.push(group);
    }
    return missing;
  }, [requiredGroups, groupedModifiers, selectedModifiers]);

  const canAdd = missingRequiredGroups.length === 0;

  const toggleModifier = (id: string, group: string) => {
    setSelectedModifiers((prev) => {
      // Check if this group is single-choice (maxSelection === 1)
      const groupMods = groupedModifiers[group] || [];
      const isSingleChoice = groupMods.some((m) => (m.maxSelection ?? 0) === 1);

      if (isSingleChoice) {
        // Radio behavior: deselect all others in this group, toggle this one
        const next = { ...prev };
        for (const m of groupMods) {
          next[m.id] = false;
        }
        next[id] = !prev[id];
        return next;
      }
      // Multi-select: simple toggle
      return { ...prev, [id]: !prev[id] };
    });
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
                  "/assets/placeholder-item-lg.svg"
                }
                alt={itemName}
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
                <h3 className="text-2xl font-bold text-[var(--text)]">{itemName}</h3>
                {itemDescription && (
                  <p className="text-sm text-[var(--text-muted)] mt-2 leading-relaxed">{itemDescription}</p>
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

              {/* Option Sets */}
              {(item.optionSets ?? []).length > 0 && (
                <div className="space-y-3">
                  {(item.optionSets ?? []).map((os) => (
                    <div key={os.id} className="rounded-xl bg-[var(--surface-subtle)] overflow-hidden">
                      <div className="px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] border-b border-[var(--divider)]">
                        {os.name}
                      </div>
                      <div className="divide-y divide-[var(--divider)]">
                        {os.options.map((o) => {
                          const checked = selectedVariants[os.id] === o.id;
                          const oPrice = o.onlinePrice ?? o.price;
                          return (
                            <label
                              key={o.id}
                              className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-[var(--surface)] transition"
                            >
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${checked ? "bg-brand border-brand" : "border-[var(--divider)]"}`}>
                                {checked && <div className="w-2 h-2 rounded-full bg-white" />}
                              </div>
                              <input
                                type="radio"
                                name={`option-set-${os.id}`}
                                checked={checked}
                                onChange={() => setSelectedVariants((prev) => ({ ...prev, [os.id]: o.id }))}
                                className="sr-only"
                              />
                              <div className="flex-1">
                                <p className="font-medium text-[var(--text)]">{o.name}</p>
                              </div>
                              <span className="text-sm font-semibold text-[var(--text-muted)]">₪{oPrice.toFixed(2)}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

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
                    {Object.entries(groupedModifiers).map(([group, modifiers]) => {
                      const isSingleChoice = modifiers.some((m) => (m.maxSelection ?? 0) === 1);
                      const isRequired = requiredGroups.has(group);
                      const isMissing = missingRequiredGroups.includes(group);
                      const freeQty = modifiers[0]?.freeQuantity ?? 0;
                      const extraPrice = modifiers[0]?.extraPrice ?? 0;
                      const hasFreeQuota = freeQty > 0;
                      // Count how many in this group are already selected
                      const selectedInGroup = modifiers.filter((m) => selectedModifiers[m.id]).length;
                      return (
                      <div key={group} className={`rounded-xl bg-[var(--surface-subtle)] overflow-hidden ${isMissing ? "ring-2 ring-red-400" : ""}`}>
                        <div className="px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] border-b border-[var(--divider)] flex items-center gap-2">
                          {group}
                          {isRequired && (
                            <span className={`text-[10px] font-semibold normal-case px-1.5 py-0.5 rounded-full ${isMissing ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"}`}>
                              {t("required") || "Required"}
                            </span>
                          )}
                          {hasFreeQuota && (
                            <span className="ml-2 text-[10px] font-semibold text-[var(--text-muted)] normal-case">
                              ({freeQty} {t("includedFree") || "included"}{extraPrice > 0 ? ` · +₪${extraPrice.toFixed(2)} ${t("each") || "each extra"}` : ""})
                            </span>
                          )}
                        </div>
                        <div className="divide-y divide-[var(--divider)]">
                          {modifiers.map((modifier, idx) => {
                            const checked = !!selectedModifiers[modifier.id];
                            // Determine dynamic label for this modifier
                            let deltaLabel = "";
                            if (hasFreeQuota) {
                              // Count how many items before this one (in render order) are selected
                              const selectedBefore = modifiers.slice(0, idx).filter((m) => selectedModifiers[m.id]).length;
                              if (checked) {
                                // Find this modifier's position among selected modifiers in the group
                                const selectedInGroupBefore = modifiers.filter((m, i) => i < idx && selectedModifiers[m.id]).length;
                                deltaLabel = selectedInGroupBefore < freeQty ? (t("free") || "Free") : `+₪${extraPrice.toFixed(2)}`;
                              } else {
                                // If we'd select it, would it be free?
                                deltaLabel = selectedInGroup < freeQty ? (t("free") || "Free") : `+₪${extraPrice.toFixed(2)}`;
                              }
                            } else {
                              const delta = modifier.priceDelta ?? 0;
                              deltaLabel = delta === 0 ? "" : `${delta > 0 ? "+" : ""}₪${delta.toFixed(2)}`;
                            }
                            return (
                              <label
                                key={modifier.id}
                                className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-[var(--surface)] transition"
                              >
                                <div className={`w-5 h-5 ${isSingleChoice ? "rounded-full" : "rounded-md"} border-2 flex items-center justify-center transition ${checked ? "bg-brand border-brand" : "border-[var(--divider)]"}`}>
                                  {checked && (
                                    isSingleChoice ? (
                                      <div className="w-2 h-2 rounded-full bg-white" />
                                    ) : (
                                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )
                                  )}
                                </div>
                                <input
                                  type={isSingleChoice ? "radio" : "checkbox"}
                                  name={isSingleChoice ? `modifier-group-${group}` : undefined}
                                  checked={checked}
                                  onChange={() => toggleModifier(modifier.id, group)}
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
                                  <span className={`text-sm font-semibold ${deltaLabel === (t("free") || "Free") ? "text-green-600" : "text-[var(--text-muted)]"}`}>
                                    {deltaLabel}
                                  </span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                      );
                    })}
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
                  if (!canAdd) return;
                  onAdd(item, qty, note, pickedModifiers, resolvedVariant?.id, resolvedVariant?.name, resolvedVariant?.price);
                  onClose();
                }}
                disabled={!canAdd}
                className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition ${canAdd ? "bg-brand text-white hover:bg-brand-dark" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}
                style={canAdd ? { boxShadow: "0 4px 20px rgba(235, 82, 4, 0.3)" } : undefined}
              >
                {canAdd ? `${t("addToCart")} · ₪${(unitPrice * qty).toFixed(2)}` : t("selectRequired") || "Please select required options"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
