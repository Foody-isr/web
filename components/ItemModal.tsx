"use client";

import { MenuItem, MenuItemModifier } from "@/lib/types";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { tField } from "@/lib/translations";
import { modalPortionLabel } from "@/lib/portion";
import { formatModifierLabel, modifiersDelta } from "@/lib/cart";
import { VerbPalette } from "@/components/VerbPalette";
import {
  enabledOperators,
  ModifierOperatorValue,
  operatorDisplayName,
  operatorPriceDelta,
} from "@/lib/modifierOperator";

type Props = {
  item?: MenuItem | null;
  /** Restaurant-wide default for the "special instructions" field. The item's
   *  own allowNotes overrides it when set. Defaults to true. */
  restaurantAllowNotes?: boolean;
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
  /** When true, the group shows the conversational verb palette. */
  useConversational: boolean;
  enabledVerbs: string[];
  modifiers: MenuItemModifier[];
};

// Height of the image hero inside the scroll content. The sticky title bar
// fades in once the user has scrolled past most of this.
const IMAGE_HEIGHT_PX = 280;

/**
 * Full-screen item detail modal (Wolt-style).
 *
 *   ┌─────────────────────────────────────┐
 *   │  [✕]                                │   floating close, dark over image
 *   │                                     │
 *   │          [item photo]               │   scrolls with the page
 *   │                                     │
 *   ├─────────────────────────────────────┤
 *   │  Name + description                 │
 *   │  Price · quantity                   │
 *   │                                     │   one scroll container
 *   │  SUPPLÉMENTS                        │   section title (plain text)
 *   │  ○ Item                       +₪5   │   row, transparent bg
 *   │  ● Item (selected)            +₪5   │   row, brand-tinted bg
 *   │  ...                                │
 *   ├─────────────────────────────────────┤
 *   │  [ Add to cart · ₪79 ]              │   sticky footer
 *   └─────────────────────────────────────┘
 *
 * After the user scrolls past the image, a sticky title bar fades in at the
 * top showing the item name — matching the Wolt pattern in the screenshot.
 */
export function ItemModal({ item, restaurantAllowNotes = true, onClose, onAdd }: Props) {
  const { t, direction, locale } = useI18n();
  const itemName = item ? tField(item, "name", locale) : "";
  const itemDescription = item ? tField(item, "description", locale) : "";
  // Whether to show the "special instructions" field: per-item override wins,
  // otherwise fall back to the restaurant-wide default.
  const notesEnabled = item?.allowNotes ?? restaurantAllowNotes;
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, boolean>>({});
  // Per-modifier chosen verb (conversational sets only).
  const [selectedOperators, setSelectedOperators] = useState<Record<string, ModifierOperatorValue>>({});
  // Per-group currently-armed verb.
  const [armedVerbs, setArmedVerbs] = useState<Record<string, ModifierOperatorValue>>({});
  const [selectedVariants, setSelectedVariants] = useState<Record<number, number>>({});

  const scrollRef = useRef<HTMLDivElement>(null);
  const [titleStuck, setTitleStuck] = useState(false);

  // Swipe-to-dismiss — Wolt-style. We use a manual `dragControls` because the
  // modal hosts a scrollable container; framer-motion's default drag listener
  // would intercept all pointer events and break native scrolling.
  //
  // Rules for starting a drag:
  //   1. Never on interactive controls (buttons, inputs, radios, etc.)
  //   2. Always-drag zones (image + drag handle) trigger drag regardless of
  //      scroll position — swiping down on the photo is unambiguously a
  //      dismiss intent. This fixes items with lots of modifiers where the
  //      customer is usually scrolled past scrollTop=0.
  //   3. Below the always-drag zones, require scrollTop ≤ 4 (small tolerance
  //      for sub-pixel rounding) so we don't hijack legitimate scrolling.
  const dragControls = useDragControls();
  const maybeStartDrag = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (
      target.closest(
        'button, input, textarea, select, a, [role="button"], [data-no-drag]',
      )
    ) {
      return;
    }
    if (target.closest('[data-drag-zone="any"]')) {
      dragControls.start(e);
      return;
    }
    if (scrollRef.current && scrollRef.current.scrollTop > 4) return;
    dragControls.start(e);
  };

  useEffect(() => {
    if (item) {
      setQty(1);
      setNote("");
      setSelectedModifiers({});
      setSelectedOperators({});
      setArmedVerbs({});
      const defaults: Record<number, number> = {};
      for (const os of item.optionSets ?? []) {
        if (os.options.length > 0) {
          defaults[os.id] = os.options[0].id;
        }
      }
      setSelectedVariants(defaults);
      setTitleStuck(false);
    }
  }, [item]);

  // Watch scroll inside the modal body — when the image has mostly scrolled
  // off, raise the sticky title bar.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !item) return;
    const onScroll = () => {
      setTitleStuck(el.scrollTop > IMAGE_HEIGHT_PX - 64);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [item]);

  // Lock body scroll + disable native overscroll while the modal is open.
  // On iOS Safari, without this a downward swipe from the top of the modal
  // bubbles to the page and triggers pull-to-refresh instead of our drag
  // dismiss. `overscroll-behavior: none` on <html> stops the page from
  // hijacking the gesture; `overflow: hidden` on <body> stops background
  // scrolling.
  useEffect(() => {
    if (!item) return;
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      bodyOverflow: body.style.overflow,
      bodyTouchAction: body.style.touchAction,
      htmlOverscroll: html.style.overscrollBehaviorY,
    };
    body.style.overflow = "hidden";
    body.style.touchAction = "none";
    html.style.overscrollBehaviorY = "none";
    return () => {
      body.style.overflow = prev.bodyOverflow;
      body.style.touchAction = prev.bodyTouchAction;
      html.style.overscrollBehaviorY = prev.htmlOverscroll;
    };
  }, [item]);

  // Unified group representation. Legacy direct modifiers and Square-compatible
  // modifier sets are merged into one list so render + validation handle both.
  const displayGroups = useMemo<DisplayGroup[]>(() => {
    if (!item) return [];
    const groups: DisplayGroup[] = [];

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
        useConversational: false,
        enabledVerbs: [],
        modifiers: mods,
      });
    }

    for (const set of item.modifierSets ?? []) {
      const setMods: MenuItemModifier[] = (set.modifiers ?? [])
        .filter((m) => m.isActive !== false && !m.hideOnline)
        .map((m) => ({
          id: m.id,
          name: m.name,
          action: m.action,
          priceDelta: m.priceDelta,
          isActive: true,
          translations: m.translations ?? null,
        }));
      if (setMods.length === 0) continue;
      const singleChoice = !set.allowMultiple || set.maxSelections === 1;
      const required = set.isRequired || set.minSelections > 0;
      // The modifier set's displayName/name lives on the source-locale columns,
      // with per-locale overrides on its translations map. Prefer displayName
      // when present (it carries its own translations on the same map).
      const useDisplayName = !!set.displayName?.trim();
      const setLabel = useDisplayName
        ? tField(set, "display_name", locale, set.displayName)
        : tField(set, "name", locale, set.name);
      groups.push({
        key: `set:${set.id}`,
        displayName: setLabel,
        isRequired: required,
        minSelections: set.minSelections,
        maxSelections: set.maxSelections,
        singleChoice,
        freeQuantity: 0,
        extraPrice: 0,
        useConversational: !!set.useConversational,
        enabledVerbs: set.enabledVerbs ?? [],
        modifiers: setMods,
      });
    }
    return groups;
  }, [item, locale]);

  const pickedModifiers = useMemo(
    () =>
      displayGroups.flatMap((g) =>
        g.modifiers
          .filter((m) => selectedModifiers[m.id])
          .map((m) =>
            g.useConversational
              ? {
                  ...m,
                  operator:
                    selectedOperators[m.id] ??
                    enabledOperators(g.enabledVerbs)[0],
                }
              : m,
          ),
      ),
    [displayGroups, selectedModifiers, selectedOperators]
  );

  const modifiersTotal = useMemo(() => modifiersDelta(pickedModifiers), [pickedModifiers]);

  const optionBasePrice = useMemo(() => {
    if (!item) return 0;
    for (const os of item.optionSets ?? []) {
      const selId = selectedVariants[os.id];
      const option = os.options.find((o) => o.id === selId);
      if (option) {
        const raw = option.onlinePrice ?? option.price;
        return raw > 0 ? raw : item.price;
      }
    }
    return item.price;
  }, [item, selectedVariants]);

  const unitPrice = useMemo(() => optionBasePrice + modifiersTotal, [optionBasePrice, modifiersTotal]);

  const resolvedVariant = useMemo(() => {
    if (!item) return undefined;
    for (const os of item.optionSets ?? []) {
      const selId = selectedVariants[os.id];
      const option = os.options.find((o) => o.id === selId);
      if (option) {
        const raw = option.onlinePrice ?? option.price;
        const effective = raw > 0 ? raw : item.price;
        return { id: option.id, name: option.name, price: effective };
      }
    }
    return undefined;
  }, [item, selectedVariants]);

  // Serving-size line under the title. Follows the selected size option so it
  // never contradicts the customer's choice; falls back to the item-level
  // portion for items without a multi-option size set. Empty when unconfigured.
  const itemPortion = useMemo(
    () => (item ? modalPortionLabel(item, locale, selectedVariants) : ""),
    [item, locale, selectedVariants],
  );

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
    if (group.useConversational) {
      applyVerb(group, id);
      return;
    }
    setSelectedModifiers((prev) => {
      if (group.singleChoice) {
        const next: Record<string, boolean> = { ...prev };
        for (const m of group.modifiers) next[m.id] = false;
        next[id] = !prev[id];
        return next;
      }
      const willEnable = !prev[id];
      if (willEnable && group.maxSelections > 0) {
        const count = group.modifiers.filter((m) => prev[m.id]).length;
        if (count >= group.maxSelections) return prev;
      }
      return { ...prev, [id]: !prev[id] };
    });
  };

  // Conversational tap: apply the group's armed verb to the modifier. Tapping
  // an already-applied modifier with the same verb removes it; a different verb
  // changes it (Square interaction).
  const applyVerb = (group: DisplayGroup, id: string) => {
    const armed =
      armedVerbs[group.key] ?? enabledOperators(group.enabledVerbs)[0];
    const isSelected = !!selectedModifiers[id];
    const currentOp = selectedOperators[id];

    if (isSelected && currentOp === armed) {
      setSelectedModifiers((p) => ({ ...p, [id]: false }));
      setSelectedOperators((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      });
      return;
    }
    if (group.singleChoice) {
      setSelectedModifiers((p) => {
        const n = { ...p };
        for (const m of group.modifiers) n[m.id] = false;
        n[id] = true;
        return n;
      });
      setSelectedOperators((p) => {
        const n = { ...p };
        for (const m of group.modifiers) delete n[m.id];
        n[id] = armed;
        return n;
      });
      return;
    }
    if (!isSelected && group.maxSelections > 0) {
      const count = group.modifiers.filter((m) => selectedModifiers[m.id]).length;
      if (count >= group.maxSelections) return;
    }
    setSelectedModifiers((p) => ({ ...p, [id]: true }));
    setSelectedOperators((p) => ({ ...p, [id]: armed }));
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
            initial={{ y: "100%", opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            dragMomentum={false}
            onDragEnd={(_, info) => {
              // Snappier threshold than the previous 120/600 — feels closer
              // to Wolt and forgives small "is this enough?" moments.
              if (info.offset.y > 80 || info.velocity.y > 450) {
                onClose();
              }
            }}
            onPointerDown={maybeStartDrag}
            onClick={(e) => e.stopPropagation()}
            className="bg-[var(--surface)] w-full sm:max-w-lg sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[100dvh] sm:h-auto sm:max-h-[92vh]"
            dir={direction}
          >
            {/* Drag handle — visible affordance AND a generous always-drag
                tap zone (16px tall) at the top of the modal. Always sits
                above the sticky title so it works at any scroll position. */}
            <div
              data-drag-zone="any"
              className="absolute top-0 inset-x-0 z-30 h-5 flex items-start justify-center pt-2"
              style={{ touchAction: "none" }}
            >
              <div className="w-10 h-1 rounded-full bg-white/55 shadow-[0_1px_2px_rgba(0,0,0,0.25)] pointer-events-none" />
            </div>
            {/* Sticky title bar — fades in after the user scrolls past the
                image. Wolt pattern: the item identity travels with the page. */}
            <div
              className={`absolute top-0 inset-x-0 z-20 transition-all duration-200 ${
                titleStuck
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 -translate-y-2 pointer-events-none"
              }`}
            >
              <div className="bg-[var(--surface)] border-b border-[var(--divider)] flex items-center gap-3 px-4 h-14 shadow-[0_4px_12px_-8px_rgba(0,0,0,0.15)]">
                <div className="flex-1 min-w-0 text-center">
                  <h3 className="font-bold text-[15px] text-[var(--text-primary)] truncate">
                    {itemName}
                  </h3>
                </div>
                <button
                  onClick={onClose}
                  className="w-9 h-9 rounded-full bg-[var(--surface-subtle)] hover:bg-[var(--divider)] flex items-center justify-center text-[var(--text-primary)] transition active:scale-[0.96]"
                  aria-label={t("close") || "Close"}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Floating close button over the image — only visible while the
                image is in view, so it never collides with the sticky bar. */}
            <button
              onClick={onClose}
              className={`absolute top-4 end-4 z-20 w-10 h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/65 transition active:scale-[0.96] ${
                titleStuck ? "opacity-0 pointer-events-none" : "opacity-100"
              }`}
              aria-label={t("close") || "Close"}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Single scroll container — image and content scroll together. */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto overscroll-contain"
            >
              {/* Image (scrolls with the page). Marked as an "always-drag"
                  zone so swiping down on the photo dismisses the modal
                  regardless of scroll position — fixes the heavy-feel on
                  items with lots of modifiers where the customer is
                  usually scrolled past the top before deciding to leave. */}
              <div
                data-drag-zone="any"
                className="relative w-full flex-shrink-0 bg-[var(--surface-subtle)]"
                style={{ height: IMAGE_HEIGHT_PX, touchAction: "none" }}
              >
                <Image
                  src={item.imageUrl || "/assets/placeholder-item-lg.svg"}
                  alt={itemName}
                  fill
                  className="object-cover pointer-events-none"
                  sizes="500px"
                  priority
                />
              </div>

              {/* Content */}
              <div className="px-5 pt-5 pb-6">
                {/* Header */}
                <h3 className="text-[26px] font-extrabold text-[var(--text-primary)] tracking-tight leading-tight">
                  {itemName}
                </h3>
                {itemPortion && (
                  <p className="text-[13px] font-semibold text-brand mt-1.5 tabular-nums">
                    {itemPortion}
                  </p>
                )}
                {itemDescription && (
                  <p className="text-[14px] text-[var(--text-soft)] mt-2 leading-relaxed">
                    {itemDescription}
                  </p>
                )}

                {/* Price and Quantity */}
                <div className="flex items-center justify-between mt-5">
                  <p className="text-[22px] font-extrabold text-brand tabular-nums">
                    ₪{unitPrice.toFixed(2)}
                  </p>
                  <div className="flex items-center gap-0 bg-[var(--surface-subtle)] rounded-full">
                    <button
                      className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--text-soft)] hover:bg-[var(--divider)] active:scale-95 transition font-bold text-lg"
                      onClick={() => setQty(Math.max(1, qty - 1))}
                      aria-label="Decrease"
                    >
                      −
                    </button>
                    <span className="font-bold min-w-[32px] text-center text-[15px] text-[var(--text-primary)] tabular-nums">
                      {qty}
                    </span>
                    <button
                      className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--text-soft)] hover:bg-[var(--divider)] active:scale-95 transition font-bold text-lg"
                      onClick={() => setQty(qty + 1)}
                      aria-label="Increase"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Variant / Option Sets — clean list pattern */}
                {(item.optionSets ?? []).map((os) => (
                  <SectionList
                    key={`os-${os.id}`}
                    title={tField(os, "name", locale, os.name)}
                    badge={null}
                  >
                    {os.options.map((o) => {
                      const checked = selectedVariants[os.id] === o.id;
                      const oPrice = o.onlinePrice ?? o.price;
                      const oPortion = tField(o, "portion", locale).trim();
                      return (
                        <ChoiceRow
                          key={o.id}
                          mode="radio"
                          checked={checked}
                          label={tField(o, "name", locale, o.name)}
                          sublabel={oPortion || undefined}
                          deltaLabel={oPrice > 0 ? `₪${oPrice.toFixed(2)}` : ""}
                          deltaTone="muted"
                          onSelect={() =>
                            setSelectedVariants((prev) => ({ ...prev, [os.id]: o.id }))
                          }
                          inputName={`os-${os.id}`}
                        />
                      );
                    })}
                  </SectionList>
                ))}

                {/* Modifier groups */}
                {displayGroups.map((g) => {
                  const isMissing = missingRequiredGroups.includes(g.key);
                  const hasFreeQuota = g.freeQuantity > 0;
                  const selectedInGroup = g.modifiers.filter((m) => selectedModifiers[m.id]).length;
                  const subtitle = (() => {
                    if (g.singleChoice) return null;
                    if (g.maxSelections > 0) {
                      return `${t("chooseUpTo") || "Choose up to"} ${g.maxSelections}${
                        selectedInGroup > 0 ? ` · ${selectedInGroup} ${t("selected") || "selected"}` : ""
                      }`;
                    }
                    return selectedInGroup > 0
                      ? `${selectedInGroup} ${t("selected") || "selected"}`
                      : null;
                  })();
                  return (
                    <SectionList
                      key={g.key}
                      title={g.displayName}
                      badge={
                        g.isRequired ? (
                          <span
                            className={`text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full ${
                              isMissing
                                ? "bg-red-50 text-red-600 ring-1 ring-red-200"
                                : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                            }`}
                          >
                            {t("required") || "Required"}
                          </span>
                        ) : hasFreeQuota ? (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-soft)]">
                            {g.freeQuantity} {t("includedFree") || "included"}
                            {g.extraPrice > 0
                              ? ` · +₪${g.extraPrice.toFixed(2)} ${t("each") || "each"}`
                              : ""}
                          </span>
                        ) : null
                      }
                      subtitle={subtitle}
                      missing={isMissing}
                    >
                      {g.useConversational && (
                        <div className="p-3 bg-[var(--surface)] border-b border-[var(--divider)]">
                          <VerbPalette
                            operators={enabledOperators(g.enabledVerbs)}
                            armed={
                              armedVerbs[g.key] ??
                              enabledOperators(g.enabledVerbs)[0]
                            }
                            onArm={(op) =>
                              setArmedVerbs((p) => ({ ...p, [g.key]: op }))
                            }
                          />
                        </div>
                      )}
                      {g.modifiers.map((modifier, idx) => {
                        const checked = !!selectedModifiers[modifier.id];
                        const convOp = g.useConversational
                          ? selectedOperators[modifier.id] ??
                            armedVerbs[g.key] ??
                            enabledOperators(g.enabledVerbs)[0]
                          : undefined;
                        let deltaLabel = "";
                        let deltaTone: "muted" | "free" = "muted";
                        if (hasFreeQuota) {
                          if (checked) {
                            const before = g.modifiers.filter(
                              (m, i) => i < idx && selectedModifiers[m.id],
                            ).length;
                            if (before < g.freeQuantity) {
                              deltaLabel = t("free") || "Free";
                              deltaTone = "free";
                            } else {
                              deltaLabel = `+₪${g.extraPrice.toFixed(2)}`;
                            }
                          } else if (selectedInGroup < g.freeQuantity) {
                            deltaLabel = t("free") || "Free";
                            deltaTone = "free";
                          } else {
                            deltaLabel = `+₪${g.extraPrice.toFixed(2)}`;
                          }
                        } else if (g.useConversational) {
                          const d = operatorPriceDelta(modifier, convOp);
                          if (d !== 0) deltaLabel = `+₪${d.toFixed(2)}`;
                        } else {
                          const delta = modifier.priceDelta ?? 0;
                          if (delta !== 0) {
                            deltaLabel = `${delta > 0 ? "+" : ""}₪${delta.toFixed(2)}`;
                          }
                        }
                        return (
                          <ChoiceRow
                            key={modifier.id}
                            mode={g.singleChoice ? "radio" : "checkbox"}
                            checked={checked}
                            label={
                              g.useConversational && checked && convOp
                                ? operatorDisplayName(
                                    convOp,
                                    (
                                      tField(modifier, "name", locale) ||
                                      modifier.name ||
                                      ""
                                    ).trim(),
                                  )
                                : formatModifierLabel(modifier, locale)
                            }
                            sublabel={
                              !g.useConversational &&
                              modifier.action === "remove"
                                ? t("removeFromRecipe") || "Remove from recipe"
                                : undefined
                            }
                            deltaLabel={deltaLabel}
                            deltaTone={deltaTone}
                            onSelect={() => toggleModifier(g, modifier.id)}
                            inputName={g.singleChoice ? `mod-${g.key}` : undefined}
                          />
                        );
                      })}
                    </SectionList>
                  );
                })}

                {/* Notes — hidden when disabled for this item (per-item override
                    or restaurant default). When hidden, `note` stays "" so the
                    add-to-cart payload is unaffected. */}
                {notesEnabled && (
                  <div className="mt-6">
                    <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-soft)] mb-2">
                      {t("notes") || "Special instructions"}
                    </label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border border-[var(--divider)] bg-[var(--surface)] text-[var(--text-primary)] text-[14px] resize-none focus:outline-none focus:border-brand transition placeholder:text-[var(--text-soft)]"
                      placeholder={t("notesPlaceholder") || "No onions, sauce on the side..."}
                      rows={2}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Sticky footer */}
            <div
              className="flex-shrink-0 p-4 bg-[var(--surface)] border-t border-[var(--divider)]"
              style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom, 0px))" }}
            >
              <button
                onClick={() => {
                  if (!canAdd) return;
                  onAdd(
                    item,
                    qty,
                    note,
                    pickedModifiers,
                    resolvedVariant?.id,
                    resolvedVariant?.name,
                    resolvedVariant?.price,
                  );
                  onClose();
                }}
                disabled={!canAdd}
                className={`w-full py-4 rounded-full font-bold text-[15px] transition flex items-center justify-center gap-2 ${
                  canAdd
                    ? "bg-brand text-white hover:bg-brand-dark active:scale-[0.99]"
                    : "bg-[var(--surface-subtle)] text-[var(--text-soft)] cursor-not-allowed"
                }`}
                style={
                  canAdd
                    ? {
                        boxShadow:
                          "0 10px 24px -8px color-mix(in srgb, var(--brand) 55%, transparent)",
                      }
                    : undefined
                }
              >
                {canAdd ? (
                  <>
                    <span>{t("addToCart")}</span>
                    <span className="opacity-50">·</span>
                    <span className="tabular-nums">₪{(unitPrice * qty).toFixed(2)}</span>
                  </>
                ) : (
                  <span>{t("selectRequired") || "Please select required options"}</span>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ────────────────────────── Section List ─────────────────────────────── */

function SectionList({
  title,
  badge,
  subtitle,
  missing,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  subtitle?: string | null;
  missing?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <div className="flex items-center gap-2 mb-2 px-1">
        <h4
          className={`text-[11px] font-extrabold uppercase tracking-[0.14em] ${
            missing ? "text-red-600" : "text-[var(--text-soft)]"
          }`}
        >
          {title}
        </h4>
        {badge}
      </div>
      {subtitle && (
        <p className="text-[12px] text-[var(--text-soft)] mb-2 px-1">{subtitle}</p>
      )}
      <div className="rounded-2xl overflow-hidden">{children}</div>
    </section>
  );
}

/* ─────────────────────────── Choice Row ──────────────────────────────── */

function ChoiceRow({
  mode,
  checked,
  label,
  sublabel,
  deltaLabel,
  deltaTone,
  onSelect,
  inputName,
}: {
  mode: "radio" | "checkbox";
  checked: boolean;
  label: string;
  sublabel?: string;
  deltaLabel: string;
  deltaTone: "muted" | "free";
  onSelect: () => void;
  inputName?: string;
}) {
  // Each row carries its own background so selection state is visible without
  // relying on :hover (which sticks on touch devices and was producing the
  // inconsistent shading the customer saw). Selected = brand-tinted, idle =
  // plain surface, with a hairline between rows.
  return (
    <label
      className={`group flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors border-b border-[var(--divider)] last:border-b-0 ${
        checked
          ? "bg-[color-mix(in_srgb,var(--brand)_8%,var(--surface))]"
          : "bg-[var(--surface)] hover:bg-[var(--surface-subtle)]"
      }`}
    >
      <div
        className={`flex-shrink-0 w-5 h-5 ${
          mode === "radio" ? "rounded-full" : "rounded-md"
        } border-2 flex items-center justify-center transition ${
          checked ? "bg-brand border-brand" : "border-[var(--divider)] bg-[var(--surface)]"
        }`}
      >
        {checked &&
          (mode === "radio" ? (
            <div className="w-2 h-2 rounded-full bg-white" />
          ) : (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.2} d="M5 13l4 4L19 7" />
            </svg>
          ))}
      </div>
      <input
        type={mode}
        name={inputName}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[14.5px] text-[var(--text-primary)] truncate">
          {label}
        </p>
        {sublabel && (
          <p className="text-[12px] text-[var(--text-soft)] mt-0.5 truncate">{sublabel}</p>
        )}
      </div>
      {deltaLabel && (
        <span
          className={`text-[13px] font-bold tabular-nums flex-shrink-0 ${
            deltaTone === "free" ? "text-emerald-600" : "text-[var(--text-soft)]"
          }`}
        >
          {deltaLabel}
        </span>
      )}
    </label>
  );
}
