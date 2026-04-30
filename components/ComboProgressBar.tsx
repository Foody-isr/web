"use client";

import { ComboMenu, ComboCartSelection } from "@/lib/types";
import { currencySymbol } from "@/lib/constants";
import { useMemo } from "react";
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
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Combo thumbnail — falls back to a brand-tinted emoji tile when
                    the combo has no image, so layout stays stable. */}
                {combo.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={combo.imageUrl}
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0 ring-1 ring-[var(--divider)]"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-brand/15 flex items-center justify-center flex-shrink-0">
                    <span className="text-base">🍽️</span>
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-[var(--text)] truncate leading-tight">
                    {combo.name}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] leading-tight mt-0.5">
                    {currencySymbol(currency)}{combo.price.toFixed(2)}
                    {extraDelta > 0 && (
                      <span className="text-brand ml-1 font-semibold">
                        +{currencySymbol(currency)}{extraDelta.toFixed(2)}
                      </span>
                    )}
                  </p>
                </div>
              </div>
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
    </AnimatePresence>
  );
}
