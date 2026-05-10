"use client";

import { ComboMenu, ComboCartSelection } from "@/lib/types";
import { currencySymbol } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

type Props = {
  combo: ComboMenu;
  currentStepIdx: number;
  selections: ComboCartSelection[];
  currency: string;
  onCancel: () => void;
  onComplete: () => void;
  onStepTap: (stepIdx: number) => void;
};

/**
 * Bottom-anchored progress card shown while the user builds a combo
 * by browsing menu items. Replaces the floating cart button during combo mode.
 */
export function ComboProgressBar({
  combo,
  currentStepIdx,
  selections,
  currency,
  onCancel,
  onComplete,
  onStepTap,
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
      return picks >= step.minPicks;
    });
  }, [combo.steps, selections]);

  const stepStatuses = useMemo(() => {
    return combo.steps.map((step) => {
      const picks = selections
        .filter((s) => s.stepId === step.id)
        .reduce((sum, s) => sum + s.quantity, 0);
      return { picks, min: step.minPicks, max: step.maxPicks, done: picks >= step.minPicks };
    });
  }, [combo.steps, selections]);

  // Overall progress: fraction of total minPicks satisfied
  const totalRequired = combo.steps.reduce((s, st) => s + st.minPicks, 0);
  const totalPicked = selections.reduce((s, sel) => s + sel.quantity, 0);
  const progressPercent = totalRequired > 0 ? Math.min(100, (totalPicked / totalRequired) * 100) : 0;

  // Quick-view: tapping the small combo thumbnail opens a modal with the full
  // image, name, description and price. Local state — selection survives the
  // open/close cycle since the wizard host stays mounted.
  const [quickViewOpen, setQuickViewOpen] = useState(false);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 120, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 120, opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className="fixed bottom-0 left-0 right-0 z-[60] px-4 pb-[env(safe-area-inset-bottom,16px)]"
      >
        <div className="mx-auto max-w-2xl rounded-2xl bg-[var(--surface-elevated)] border border-[var(--divider)] shadow-2xl overflow-hidden">
          {/* Overall progress bar — thin accent strip at top of the card */}
          <div className="h-1 bg-[var(--surface-subtle)]">
            <motion.div
              className="h-full bg-brand rounded-full"
              animate={{ width: `${progressPercent}%` }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
            />
          </div>

          <div className="px-4 pt-3.5 pb-4 space-y-3">
            {/* Row 1: Combo title + price + cancel */}
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setQuickViewOpen(true)}
                className="flex items-center gap-2.5 min-w-0 text-start group/thumb"
                aria-label="View combo details"
              >
                {/* Combo thumbnail — clickable to open the quick-view modal.
                    Falls back to a brand-tinted emoji tile when the combo has
                    no image, so layout stays stable. The expand badge bottom-
                    right is the affordance hint: it shows the tile is tappable
                    even on touch devices where there is no hover state. */}
                <span className="relative flex-shrink-0">
                  {combo.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={combo.imageUrl}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover ring-1 ring-[var(--divider)] group-hover/thumb:ring-brand/60 transition-shadow"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-brand/15 flex items-center justify-center group-hover/thumb:bg-brand/25 transition-colors">
                      <span className="text-base">🍽️</span>
                    </div>
                  )}
                  <span
                    className="absolute -bottom-1 -end-1 w-4 h-4 rounded-full bg-brand text-white flex items-center justify-center shadow-sm ring-2 ring-[var(--surface-elevated)]"
                    aria-hidden
                  >
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  </span>
                </span>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-[var(--text)] truncate leading-tight group-hover/thumb:text-brand transition-colors">
                    {combo.name}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] leading-tight mt-0.5 flex items-center gap-1.5">
                    <span className="tabular-nums">
                      {currencySymbol(currency)}{combo.price.toFixed(2)}
                      {extraDelta > 0 && (
                        <span className="text-brand ml-1 font-semibold">
                          +{currencySymbol(currency)}{extraDelta.toFixed(2)}
                        </span>
                      )}
                    </span>
                    <span className="opacity-50">·</span>
                    <span className="text-brand/80 group-hover/thumb:underline">
                      {t("comboViewDetails")}
                    </span>
                  </p>
                </div>
              </button>
              <button
                onClick={onCancel}
                className="flex-shrink-0 w-7 h-7 rounded-full bg-[var(--surface-subtle)] hover:bg-red-500/20 flex items-center justify-center transition-colors group"
                aria-label="Cancel combo"
              >
                <svg className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-red-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Row 2: Step pills */}
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1">
              {combo.steps.map((step, idx) => {
                const status = stepStatuses[idx];
                const isCurrent = idx === currentStepIdx;
                return (
                  <button
                    key={step.id}
                    onClick={() => onStepTap(idx)}
                    className={clsx(
                      "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
                      // Done (green) — regardless of whether it's the current step
                      status.done && "bg-green-500/15 text-green-500",
                      // Current & not done — brand orange
                      isCurrent && !status.done && "bg-brand text-white shadow-sm shadow-brand/30",
                      // Not current & not done — muted
                      !isCurrent && !status.done && "bg-[var(--surface-subtle)] text-[var(--text-muted)]"
                    )}
                  >
                    {status.done ? (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : isCurrent ? (
                      <span className="tabular-nums">{status.picks}/{status.min}</span>
                    ) : null}
                    <span>{step.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Row 3: Current step instruction OR "Add to cart" button */}
            {allStepsComplete ? (
              <motion.button
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={onComplete}
                className="w-full py-3 rounded-xl bg-brand text-white font-bold text-sm shadow-lg shadow-brand/25 hover:brightness-110 active:scale-[0.98] transition-all"
              >
                Add to cart · {currencySymbol(currency)}{(combo.price + extraDelta).toFixed(2)}
              </motion.button>
            ) : currentStep ? (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-[var(--text-muted)]">
                    <span className="font-semibold text-[var(--text)]">{currentStep.name}</span>
                    {" — "}
                    {currentStep.minPicks === currentStep.maxPicks
                      ? `Pick ${currentStep.minPicks}`
                      : `Pick ${currentStep.minPicks}–${currentStep.maxPicks}`}
                  </p>
                  {currentStep.description && (
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2">
                      {currentStep.description}
                    </p>
                  )}
                </div>
                <span className="text-xs font-bold text-brand tabular-nums shrink-0 mt-0.5">
                  {currentStepPicks}/{currentStep.minPicks}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </motion.div>

      {/* Quick-view modal — opens when the user taps the small thumbnail in the
          progress bar. Renders inside the same AnimatePresence so its exit
          animation plays alongside the bar's. */}
      {quickViewOpen && (
        <ComboQuickView
          combo={combo}
          currency={currency}
          onClose={() => setQuickViewOpen(false)}
        />
      )}
    </AnimatePresence>
  );
}

/**
 * Modal showing the combo's full image, name, description and price. Read-only
 * — closing returns to the wizard with selections intact.
 */
function ComboQuickView({
  combo,
  currency,
  onClose,
}: {
  combo: ComboMenu;
  currency: string;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0, scale: 0.96 }}
        transition={{ type: "spring", damping: 26, stiffness: 320 }}
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-[var(--surface-elevated)] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image — falls back to a soft brand-tinted block when missing so the
            modal doesn't feel empty. */}
        <div className="relative aspect-[4/3] bg-[var(--surface-subtle)]">
          {combo.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={combo.imageUrl}
              alt={combo.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-brand/10">
              <span className="text-6xl">🍽️</span>
            </div>
          )}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-bold text-xl text-[var(--text)] leading-tight">
              {combo.name}
            </h2>
            <span className="font-bold text-lg text-brand tabular-nums shrink-0">
              {currencySymbol(currency)}{combo.price.toFixed(2)}
            </span>
          </div>
          {combo.description && (
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
              {combo.description}
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
