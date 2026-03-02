"use client";

import { ComboMenu, ComboCartSelection } from "@/lib/types";
import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
 * Floating progress bar shown at the top of the menu while the user is
 * building a combo by browsing regular menu items.
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

  // Selections for the current step
  const currentStepPicks = useMemo(() => {
    if (!currentStep) return 0;
    return selections
      .filter((s) => s.stepId === currentStep.id)
      .reduce((sum, s) => sum + s.quantity, 0);
  }, [currentStep, selections]);

  // Total extra delta from all selections
  const extraDelta = useMemo(() => {
    return selections.reduce((sum, s) => sum + s.priceDelta * s.quantity, 0);
  }, [selections]);

  // Are all steps complete?
  const allStepsComplete = useMemo(() => {
    return combo.steps.every((step) => {
      const picks = selections
        .filter((s) => s.stepId === step.id)
        .reduce((sum, s) => sum + s.quantity, 0);
      return picks >= step.minPicks;
    });
  }, [combo.steps, selections]);

  // Step completion counts for the pill indicators
  const stepStatuses = useMemo(() => {
    return combo.steps.map((step) => {
      const picks = selections
        .filter((s) => s.stepId === step.id)
        .reduce((sum, s) => sum + s.quantity, 0);
      return { picks, min: step.minPicks, max: step.maxPicks, done: picks >= step.minPicks };
    });
  }, [combo.steps, selections]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -80, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed top-0 left-0 right-0 z-[55] bg-[var(--surface-card)] border-b border-[var(--border-light)] shadow-lg backdrop-blur-xl"
      >
        {/* Top row: combo name + cancel */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg">🍽️</span>
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-[var(--text)] truncate">
                {combo.name}
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                {currency}{(combo.price + extraDelta).toFixed(2)}
                {extraDelta > 0 && (
                  <span className="text-brand ml-1">
                    (+{currency}{extraDelta.toFixed(2)})
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-xs font-semibold text-[var(--text-muted)] hover:text-red-500 transition-colors px-2 py-1"
          >
            ✕ Cancel
          </button>
        </div>

        {/* Step pills */}
        <div className="flex gap-1.5 px-4 pb-2 overflow-x-auto scrollbar-hide">
          {combo.steps.map((step, idx) => {
            const status = stepStatuses[idx];
            const isCurrent = idx === currentStepIdx;
            return (
              <button
                key={step.id}
                onClick={() => onStepTap(idx)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  isCurrent
                    ? "bg-brand text-white shadow-sm"
                    : status.done
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-[var(--surface-subtle)] text-[var(--text-muted)]"
                }`}
              >
                {/* Completion indicator */}
                {status.done ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : isCurrent ? (
                  <span className="w-4 text-center">{status.picks}/{status.min}</span>
                ) : null}
                <span>{step.name}</span>
              </button>
            );
          })}
        </div>

        {/* Current step instruction */}
        <div className="px-4 pb-3 flex items-center justify-between">
          <p className="text-xs text-[var(--text-muted)]">
            {currentStep && (
              <>
                <span className="font-semibold text-[var(--text)]">
                  {currentStep.name}
                </span>
                {" — "}
                {currentStep.minPicks === currentStep.maxPicks
                  ? `Pick ${currentStep.minPicks}`
                  : `Pick ${currentStep.minPicks}–${currentStep.maxPicks}`}
                {" · "}
                <span className="text-brand font-bold">
                  {currentStepPicks} selected
                </span>
              </>
            )}
          </p>
          {allStepsComplete && (
            <motion.button
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={onComplete}
              className="bg-brand text-white text-xs font-bold px-4 py-2 rounded-full shadow-md hover:bg-brand/90 transition-colors"
            >
              Add to cart · {currency}{(combo.price + extraDelta).toFixed(2)}
            </motion.button>
          )}
        </div>

        {/* Progress bar for current step */}
        {currentStep && (
          <div className="h-1 bg-[var(--surface-subtle)]">
            <motion.div
              className="h-full bg-brand"
              initial={{ width: 0 }}
              animate={{
                width: `${Math.min(100, (currentStepPicks / (currentStep.minPicks || 1)) * 100)}%`,
              }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
            />
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
