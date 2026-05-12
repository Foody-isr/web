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

type DisplayGroup = {
  key: string;
  displayName: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number; // 0 = unlimited
  singleChoice: boolean;
  freeQuantity: number;
  extraPrice: number;
  modifiers: MenuItemModifier[];
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

  // Unified group representation. Legacy direct modifiers and Square-compatible
  // modifier sets are merged into one list so render + validation handle both.
  const displayGroups = useMemo<DisplayGroup[]>(() => {
    if (!item) return [];
    const groups: DisplayGroup[] = [];

    // Legacy direct modifiers: bucket by category, derive rules per-modifier.
    const legacyActive = (item.modifiers ?? []).filter((m) => m.isActive !== false);
    const byCategory: Record<string, MenuItemModifier[]> = {};
    for (const m of legacyActive) {
      const key = m.category?.trim() || "Modifiers";
      (byCategory[key] ??= []).push(m);
    }
    for (const [name, mods] of Object.entries(byCategory)) {
      const required = mods.some((m) => m.isRequired);
      const singleChoice = mods.some((m) => (m.maxSelection ?? 0) === 1);
      groups.push({
        key: `legacy:${name}`,
        displayName: name,
        isRequired: required,
        minSelections: required ? 1 : 0,
        maxSelections: singleChoice ? 1 : 0,
        singleChoice,
        freeQuantity: mods[0]?.freeQuantity ?? 0,
        extraPrice: mods[0]?.extraPrice ?? 0,
        modifiers: mods,
      });
    }

    // Modifier sets (Square-compatible): each set is its own group.
    for (const set of item.modifierSets ?? []) {
      const setMods: MenuItemModifier[] = (set.modifiers ?? [])
        .filter((m) => m.isActive !== false && !m.hideOnline)
        .map((m) => ({
          id: m.id,
          name: m.name,
          action: m.action,
          priceDelta: m.priceDelta,
          isActive: true,
        }));
      if (setMods.length === 0) continue;
      const singleChoice = !set.allowMultiple || set.maxSelections === 1;
      const required = set.isRequired || set.minSelections > 0;
      groups.push({
        key: `set:${set.id}`,
        displayName: set.displayName?.trim() || set.name,
        isRequired: required,
        minSelections: set.minSelections,
        maxSelections: set.maxSelections,
        singleChoice,
        freeQuantity: 0,
        extraPrice: 0,
        modifiers: setMods,
      });
    }
    return groups;
  }, [item]);

  const pickedModifiers = useMemo(
    () => displayGroups.flatMap((g) => g.modifiers.filter((m) => selectedModifiers[m.id])),
    [displayGroups, selectedModifiers]
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

  // A group is unmet when its selection count falls below the required minimum.
  const missingRequiredGroups = useMemo(() => {
    const missing: string[] = [];
    for (const g of displayGroups) {
      if (!g.isRequired) continue;
      const count = g.modifiers.filter((m) => selectedModifiers[m.id]).length;
      const min = Math.max(g.minSelections, 1);
      if (count < min) missing.push(g.key);
    }
    return missing;
  }, [displayGroups, selectedModifiers]);

  const canAdd = missingRequiredGroups.length === 0;

  const toggleModifier = (group: DisplayGroup, id: string) => {
    setSelectedModifiers((prev) => {
      if (group.singleChoice) {
        // Radio behavior: clear the rest of the group, toggle this one.
        const next: Record<string, boolean> = { ...prev };
        for (const m of group.modifiers) next[m.id] = false;
        next[id] = !prev[id];
        return next;
      }
      // Multi-select: enforce maxSelections (0 = unlimited).
      const willEnable = !prev[id];
      if (willEnable && group.maxSelections > 0) {
        const count = group.modifiers.filter((m) => prev[m.id]).length;
        if (count >= group.maxSelections) return prev;
      }
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
              {displayGroups.length > 0 && (
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
                    {displayGroups.map((g) => {
                      const isMissing = missingRequiredGroups.includes(g.key);
                      const hasFreeQuota = g.freeQuantity > 0;
                      const selectedInGroup = g.modifiers.filter((m) => selectedModifiers[m.id]).length;
                      return (
                      <div key={g.key} className={`rounded-xl bg-[var(--surface-subtle)] overflow-hidden ${isMissing ? "ring-2 ring-red-400" : ""}`}>
                        <div className="px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] border-b border-[var(--divider)] flex items-center gap-2">
                          {g.displayName}
                          {g.isRequired && (
                            <span className={`text-[10px] font-semibold normal-case px-1.5 py-0.5 rounded-full ${isMissing ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"}`}>
                              {t("required") || "Required"}
                            </span>
                          )}
                          {hasFreeQuota && (
                            <span className="ml-2 text-[10px] font-semibold text-[var(--text-muted)] normal-case">
                              ({g.freeQuantity} {t("includedFree") || "included"}{g.extraPrice > 0 ? ` · +₪${g.extraPrice.toFixed(2)} ${t("each") || "each extra"}` : ""})
                            </span>
                          )}
                        </div>
                        <div className="divide-y divide-[var(--divider)]">
                          {g.modifiers.map((modifier, idx) => {
                            const checked = !!selectedModifiers[modifier.id];
                            let deltaLabel = "";
                            if (hasFreeQuota) {
                              if (checked) {
                                const selectedInGroupBefore = g.modifiers.filter((m, i) => i < idx && selectedModifiers[m.id]).length;
                                deltaLabel = selectedInGroupBefore < g.freeQuantity ? (t("free") || "Free") : `+₪${g.extraPrice.toFixed(2)}`;
                              } else {
                                deltaLabel = selectedInGroup < g.freeQuantity ? (t("free") || "Free") : `+₪${g.extraPrice.toFixed(2)}`;
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
                                <div className={`w-5 h-5 ${g.singleChoice ? "rounded-full" : "rounded-md"} border-2 flex items-center justify-center transition ${checked ? "bg-brand border-brand" : "border-[var(--divider)]"}`}>
                                  {checked && (
                                    g.singleChoice ? (
                                      <div className="w-2 h-2 rounded-full bg-white" />
                                    ) : (
                                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )
                                  )}
                                </div>
                                <input
                                  type={g.singleChoice ? "radio" : "checkbox"}
                                  name={g.singleChoice ? `modifier-group-${g.key}` : undefined}
                                  checked={checked}
                                  onChange={() => toggleModifier(g, modifier.id)}
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
