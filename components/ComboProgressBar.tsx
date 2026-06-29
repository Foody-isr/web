"use client";

import { ComboMenu, ComboCartSelection } from "@/lib/types";
import { currencySymbol } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ComboDetailsModal } from "@/components/ComboDetailsModal";

type Props = {
  combo: ComboMenu;
  currentStepIdx: number;
  selections: ComboCartSelection[];
  currency: string;
  onCancel: () => void;
  onComplete: () => void;
  onStepTap: (stepIdx: number) => void;
  /** Step items for the current step that aren't reachable through the menu
   *  grid (e.g. items not in any web-enabled group, or combo_only items).
   *  Rendered in the "Also in this step" row so the combo can't get stuck. */
  offCarteStepItems?: Array<{
    menuItemId: number;
    optionId?: number | null;
    priceDelta: number;
    menuItem?: { id?: number; name?: string; imageUrl?: string; price?: number };
  }>;
  /** Live pick count per MenuItem.id (stringified). Same map the menu cards
   *  use, so the count badge stays in sync. */
  picksByItem?: Map<string, number>;
  onPickStepItem?: (si: NonNullable<Props['offCarteStepItems']>[number]) => void;
  onRemoveStepItem?: (si: NonNullable<Props['offCarteStepItems']>[number]) => void;
  /** How many of this combo are being built in one batch. Default 1. Each
   *  step's target is multiplied by this. */
  multiplier?: number;
};

/**
 * Bottom-anchored progress card shown while the user builds a combo by browsing
 * menu items. Replaces the floating cart button during combo mode.
 *
 * Layout (Option A — "step headline hero"): the current step's title is the
 * largest element so customers can't miss what to do, with a big live count
 * badge on the side. The combo name is demoted to a small footer row. Picking
 * an item pops the badge, sweeps the progress bar, and cross-fades the headline
 * to the next step — feedback customers previously said they didn't notice.
 */
export function ComboProgressBar({
  combo,
  currentStepIdx,
  selections,
  currency,
  onCancel,
  onComplete,
  onStepTap,
  offCarteStepItems,
  picksByItem,
  onPickStepItem,
  onRemoveStepItem,
  multiplier = 1,
}: Props) {
  const { t } = useI18n();
  const currentStep = combo.steps[currentStepIdx];

  const currentStepPicks = useMemo(() => {
    if (!currentStep) return 0;
    return selections
      .filter((s) => s.stepId === currentStep.id)
      .reduce((sum, s) => sum + s.quantity, 0);
  }, [currentStep, selections]);

  const extraDelta = useMemo(() => {
    return selections.reduce((sum, s) => sum + s.priceDelta * s.quantity, 0);
  }, [selections]);

  const allStepsComplete = useMemo(() => {
    return combo.steps.every((step) => {
      const picks = selections
        .filter((s) => s.stepId === step.id)
        .reduce((sum, s) => sum + s.quantity, 0);
      return picks >= step.minPicks * multiplier;
    });
  }, [combo.steps, selections, multiplier]);

  // Overall progress: fraction of total minPicks satisfied.
  const totalRequired = combo.steps.reduce((s, st) => s + st.minPicks * multiplier, 0);
  const totalPicked = selections.reduce((s, sel) => s + sel.quantity, 0);
  const progressPercent =
    totalRequired > 0 ? Math.min(100, (totalPicked / totalRequired) * 100) : 0;

  // Glow sweep across the progress bar each time the pick total grows. We bump
  // a key on increase so the swept highlight remounts and replays.
  const [glowKey, setGlowKey] = useState(0);
  const prevTotal = useRef(totalPicked);
  useEffect(() => {
    if (totalPicked > prevTotal.current) setGlowKey((k) => k + 1);
    prevTotal.current = totalPicked;
  }, [totalPicked]);

  // Quick-view modal (reuses ComboDetailsModal in read-only mode). Local state —
  // selections survive the open/close cycle since the wizard host stays mounted.
  const [quickViewOpen, setQuickViewOpen] = useState(false);

  // Localised "Step X of Y" / "Pick N" / "Pick min–max" labels.
  const stepProgressLabel = t("comboStepProgress")
    .replace("{n}", String(currentStepIdx + 1))
    .replace("{total}", String(combo.steps.length));
  const pickLabel = currentStep
    ? currentStep.minPicks === currentStep.maxPicks
      ? t("comboPickExact").replace("{n}", String(currentStep.minPicks * multiplier))
      : t("comboPickRange")
          .replace("{min}", String(currentStep.minPicks * multiplier))
          .replace("{max}", String(currentStep.maxPicks * multiplier))
    : "";

  return (
    <>
      <motion.div
        initial={{ y: 120, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 120, opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className="fixed bottom-0 left-0 right-0 z-[60] px-4 pb-[env(safe-area-inset-bottom,16px)]"
      >
        <div className="mx-auto max-w-2xl rounded-2xl bg-[var(--surface-elevated)] border border-[var(--divider)] shadow-2xl overflow-hidden">
          {/* Thicker progress bar with a glow sweep on each add. */}
          <div className="h-1.5 bg-[var(--surface-subtle)] relative overflow-hidden">
            <motion.div
              className="h-full bg-brand"
              animate={{ width: `${progressPercent}%` }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
            />
            {glowKey > 0 && (
              <motion.div
                key={glowKey}
                className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent"
                initial={{ x: "-120%" }}
                animate={{ x: "420%" }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            )}
          </div>

          <div className="px-4 pt-3.5 pb-4">
            {/* Row 1: step headline hero + big live count badge */}
            <div className="flex items-start justify-between gap-3 min-h-[58px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={allStepsComplete ? "done" : currentStepIdx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.28 }}
                  className="min-w-0 flex-1"
                >
                  {allStepsComplete ? (
                    <>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-green-500">
                        {t("comboAllSet")} 🎉
                      </p>
                      <h3 className="text-xl font-extrabold text-[var(--text)] leading-tight mt-0.5">
                        {t("comboReady")}
                      </h3>
                    </>
                  ) : currentStep ? (
                    <>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-brand">
                        {stepProgressLabel}
                      </p>
                      <h3 className="text-xl font-extrabold text-[var(--text)] leading-tight mt-0.5 truncate">
                        {currentStep.name}
                      </h3>
                      <p className="text-[13px] text-[var(--text-muted)] mt-0.5 line-clamp-1">
                        {pickLabel}
                        {currentStep.description ? ` · ${currentStep.description}` : ""}
                      </p>
                    </>
                  ) : null}
                </motion.div>
              </AnimatePresence>

              {!allStepsComplete && currentStep && (
                <motion.div
                  key={`badge-${currentStepIdx}-${currentStepPicks}`}
                  initial={{ scale: 1 }}
                  animate={{ scale: currentStepPicks > 0 ? [1, 1.35, 1] : 1 }}
                  transition={{ duration: 0.45, times: [0, 0.4, 1], ease: "easeOut" }}
                  id="combo-count-target"
                  className="relative flex-shrink-0 min-w-[52px] h-[52px] px-2 rounded-2xl bg-brand text-white font-extrabold text-xl flex items-center justify-center shadow-md shadow-brand/30 tabular-nums"
                >
                  {currentStepPicks > 0 && (
                    <motion.span
                      key={`flash-${currentStepPicks}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 0.9, 0] }}
                      transition={{ duration: 0.45, ease: "easeOut" }}
                      className="absolute inset-0 rounded-2xl bg-green-500"
                    />
                  )}
                  <span className="relative z-10">
                    {currentStepPicks}/{currentStep.minPicks * multiplier}
                  </span>
                </motion.div>
              )}
            </div>

            {/* Row 2: previous-step button. Replaces the older slim step-dots
                row — explicit "go back one step" beats opaque navigation pins. */}
            {currentStepIdx > 0 && (
              <div className="mt-2.5 flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => onStepTap(currentStepIdx - 1)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-brand transition-colors py-1 -ms-1 px-1"
                >
                  <svg
                    className="w-3.5 h-3.5 rtl:rotate-180"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  {t("comboPreviousStep")}
                </button>
              </div>
            )}

            {/* Row 2.5: "Also in this step" — selectable cards for items the
                customer can't reach by browsing the menu (no web-group
                membership, or combo_only). Hidden when every step item is
                on the carte, and once the combo is complete. */}
            {!allStepsComplete &&
              currentStep &&
              offCarteStepItems &&
              offCarteStepItems.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5">
                    {t("comboAlsoInThisStep")}
                  </p>
                  <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
                    {offCarteStepItems.map((si) => {
                      const idKey = String(si.menuItemId);
                      const count = picksByItem?.get(idKey) ?? 0;
                      const stepFull =
                        currentStepPicks >= currentStep.maxPicks;
                      return (
                        <div
                          key={`${si.menuItemId}-${si.optionId ?? "noop"}`}
                          data-combo-item-id={si.menuItemId}
                          className="relative flex-shrink-0 w-24 rounded-xl border border-[var(--divider)] bg-[var(--surface)] overflow-hidden"
                        >
                          <button
                            type="button"
                            disabled={stepFull && count === 0}
                            onClick={() => onPickStepItem?.(si)}
                            className="block w-full text-start hover:border-brand active:scale-[0.98] transition-transform disabled:opacity-50"
                          >
                            <div className="relative h-16 bg-[var(--surface-subtle)]">
                              {si.menuItem?.imageUrl ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={si.menuItem.imageUrl}
                                  alt={si.menuItem?.name ?? ""}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-2xl">
                                  🍽️
                                </div>
                              )}
                              {count > 0 && (
                                <div className="absolute top-1 end-1 min-w-[20px] h-5 px-1 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                                  ×{count}
                                </div>
                              )}
                            </div>
                            <div className="px-2 py-1.5">
                              <p className="text-[11px] font-semibold text-[var(--text)] truncate">
                                {si.menuItem?.name ?? ""}
                              </p>
                              {si.priceDelta > 0 && (
                                <p className="text-[10px] text-brand font-semibold tabular-nums">
                                  +{currencySymbol(currency)}
                                  {si.priceDelta.toFixed(2)}
                                </p>
                              )}
                            </div>
                          </button>
                          {count > 0 && onRemoveStepItem && (
                            <button
                              type="button"
                              onClick={() => onRemoveStepItem(si)}
                              aria-label="Remove one"
                              className="absolute top-1 start-1 w-5 h-5 rounded-full bg-black/55 hover:bg-black/75 text-white text-[12px] font-bold leading-none flex items-center justify-center"
                            >
                              −
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* Row 3: "Add to cart" CTA — rises in when every step is satisfied. */}
            {allStepsComplete && (
              <motion.button
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", damping: 22, stiffness: 320 }}
                onClick={onComplete}
                className="w-full mt-3 py-3 rounded-xl bg-brand text-white font-bold text-base shadow-lg shadow-brand/25 hover:brightness-110 active:scale-[0.98] transition-all"
              >
                {multiplier > 1
                  ? `${t("comboAddAll").replace("{n}", String(multiplier))} · ${currencySymbol(currency)}${(combo.price * multiplier + extraDelta).toFixed(2)}`
                  : `${t("addToCart")} · ${currencySymbol(currency)}${(combo.price + extraDelta).toFixed(2)}`}
              </motion.button>
            )}

            {/* Divider + footer mini row: combo identity (demoted) + cancel. */}
            <div className="h-px bg-[var(--divider)] my-3" />
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setQuickViewOpen(true)}
                className="flex items-center gap-2 min-w-0 text-start group/thumb"
                aria-label={t("comboViewDetails")}
              >
                {combo.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={combo.imageUrl}
                    alt=""
                    className="w-7 h-7 rounded-md object-cover ring-1 ring-[var(--divider)] group-hover/thumb:ring-brand/60 transition-shadow flex-shrink-0"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-md bg-brand/15 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm">🍽️</span>
                  </div>
                )}
                <span className="text-xs text-[var(--text-muted)] truncate">
                  <span className="font-semibold text-[var(--text-secondary)]">
                    {combo.name}
                  </span>
                  <span className="mx-1 opacity-50">·</span>
                  <span className="tabular-nums">
                    {currencySymbol(currency)}
                    {combo.price.toFixed(2)}
                    {extraDelta > 0 && (
                      <span className="text-brand ml-1 font-semibold">
                        +{currencySymbol(currency)}
                        {extraDelta.toFixed(2)}
                      </span>
                    )}
                  </span>
                  <span className="mx-1 opacity-50">·</span>
                  <span className="text-brand/80 group-hover/thumb:underline">
                    {t("comboViewDetails")}
                  </span>
                </span>
              </button>
              <button
                onClick={onCancel}
                className="flex-shrink-0 w-7 h-7 rounded-full bg-[var(--surface-subtle)] hover:bg-red-500/20 flex items-center justify-center transition-colors group"
                aria-label={t("cancel")}
              >
                <svg
                  className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-red-500 transition-colors"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick-view — reuses the unified entry modal in read-only mode. */}
      <ComboDetailsModal
        combo={quickViewOpen ? combo : null}
        currency={currency}
        onClose={() => setQuickViewOpen(false)}
        readOnly
      />
    </>
  );
}
