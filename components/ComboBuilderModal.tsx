"use client";

import { ComboMenu, ComboCartSelection } from "@/lib/types";
import { currencySymbol } from "@/lib/constants";
import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";

type Props = {
  combo: ComboMenu | null;
  currency: string;
  onClose: () => void;
  onAdd: (
    comboId: number,
    comboName: string,
    comboPrice: number,
    selections: ComboCartSelection[]
  ) => void;
};

/**
 * ComboBuilderModal guides the guest through each combo step (e.g. choose salads,
 * choose main, choose side) and validates min/max picks before adding to cart.
 */
export function ComboBuilderModal({ combo, currency, onClose, onAdd }: Props) {
  // selections: stepId → { menuItemId → quantity }
  const [selections, setSelections] = useState<
    Record<number, Record<number, number>>
  >({});
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  // Reset state when combo changes
  const comboId = combo?.id;
  const [prevComboId, setPrevComboId] = useState<number | undefined>();
  if (comboId !== prevComboId) {
    setPrevComboId(comboId);
    setSelections({});
    setCurrentStepIdx(0);
  }

  const currentStep = combo?.steps?.[currentStepIdx] ?? null;
  const totalSteps = combo?.steps?.length ?? 0;
  const isLastStep = currentStepIdx >= totalSteps - 1;

  // Auto-include pattern: when a step has a single option and requires picks,
  // pre-fill the quantity to min_picks. The customer has no real choice — the
  // step is just declaring "this combo includes N of X" (e.g. 2 challahs).
  // Skipped when the customer has already touched the step.
  useEffect(() => {
    if (!currentStep) return;
    if (currentStep.items.length !== 1) return;
    if (currentStep.minPicks < 1) return;
    const onlyItem = currentStep.items[0];
    const existing = selections[currentStep.id];
    if (existing && Object.keys(existing).length > 0) return;
    setSelections((prev) => ({
      ...prev,
      [currentStep.id]: { [onlyItem.menuItemId]: currentStep.minPicks },
    }));
  }, [currentStep, selections]);

  // Count picks in current step
  const currentPicks = useMemo(() => {
    if (!currentStep) return 0;
    const stepSels = selections[currentStep.id] ?? {};
    return Object.values(stepSels).reduce((s, q) => s + q, 0);
  }, [currentStep, selections]);

  const isStepValid = useMemo(() => {
    if (!currentStep) return false;
    if (currentStep.minPicks > 0 && currentPicks < currentStep.minPicks) return false;
    if (currentStep.maxPicks > 0 && currentPicks > currentStep.maxPicks) return false;
    return currentPicks > 0;
  }, [currentStep, currentPicks]);

  // Calculate total upgrade delta
  const extraDelta = useMemo(() => {
    if (!combo) return 0;
    let delta = 0;
    for (const step of combo.steps) {
      const stepSels = selections[step.id] ?? {};
      for (const item of step.items) {
        const qty = stepSels[item.menuItemId] ?? 0;
        delta += item.priceDelta * qty;
      }
    }
    return delta;
  }, [combo, selections]);

  const toggleItem = useCallback(
    (stepId: number, menuItemId: number, maxPicks: number) => {
      setSelections((prev) => {
        const stepSels = { ...(prev[stepId] ?? {}) };
        const current = stepSels[menuItemId] ?? 0;
        const total = Object.values(stepSels).reduce((s, q) => s + q, 0);

        if (current > 0) {
          // Deselect
          delete stepSels[menuItemId];
        } else {
          // If single pick, clear previous selections
          if (maxPicks === 1) {
            for (const k of Object.keys(stepSels)) {
              delete stepSels[Number(k)];
            }
            stepSels[menuItemId] = 1;
          } else if (maxPicks > 0 && total >= maxPicks) {
            // At max — don't add
            return prev;
          } else {
            stepSels[menuItemId] = 1;
          }
        }
        return { ...prev, [stepId]: stepSels };
      });
    },
    []
  );

  const handleNext = () => {
    if (isLastStep) {
      // Submit
      if (!combo) return;
      const allSelections: ComboCartSelection[] = [];
      for (const step of combo.steps) {
        const stepSels = selections[step.id] ?? {};
        for (const item of step.items) {
          const qty = stepSels[item.menuItemId] ?? 0;
          if (qty > 0) {
            allSelections.push({
              stepId: step.id,
              stepName: step.name,
              menuItemId: item.menuItemId,
              menuItemName: item.menuItem.name,
              quantity: qty,
              priceDelta: item.priceDelta,
            });
          }
        }
      }
      onAdd(combo.id, combo.name, combo.price, allSelections);
      onClose();
    } else {
      setCurrentStepIdx((i) => i + 1);
    }
  };

  if (!combo) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-[var(--surface-card)] rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-[var(--border-light)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">
                {combo.name}
              </h2>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                {currencySymbol(currency)}
                {combo.price.toFixed(2)}
                {extraDelta > 0 && (
                  <span className="text-brand">
                    {" "}
                    + {currencySymbol(currency)}
                    {extraDelta.toFixed(2)}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[var(--surface-subtle)] flex items-center justify-center"
            >
              ✕
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex gap-1.5 mt-3">
            {combo.steps.map((step, idx) => (
              <div
                key={step.id}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  idx < currentStepIdx
                    ? "bg-brand"
                    : idx === currentStepIdx
                    ? "bg-brand/60"
                    : "bg-[var(--surface-subtle)]"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step content */}
        {currentStep && (
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="mb-4">
              <h3 className="font-semibold text-lg text-[var(--text-primary)]">
                {currentStep.name}
              </h3>
              {currentStep.description && (
                <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                  {currentStep.description}
                </p>
              )}
              <p className="text-sm text-[var(--text-muted)] mt-1">
                {currentStep.minPicks === currentStep.maxPicks
                  ? `Choose exactly ${currentStep.minPicks}`
                  : `Choose ${currentStep.minPicks}–${currentStep.maxPicks}`}
                {" · "}
                <span className="font-medium">
                  {currentPicks} selected
                </span>
              </p>
            </div>

            <div className="space-y-2">
              {currentStep.items.map((stepItem) => {
                const selected =
                  (selections[currentStep.id]?.[stepItem.menuItemId] ?? 0) > 0;
                return (
                  <button
                    key={stepItem.id}
                    type="button"
                    onClick={() =>
                      toggleItem(
                        currentStep.id,
                        stepItem.menuItemId,
                        currentStep.maxPicks
                      )
                    }
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      selected
                        ? "border-brand bg-brand/5 ring-1 ring-brand"
                        : "border-[var(--border-light)] bg-[var(--surface-card)] hover:bg-[var(--surface-subtle)]"
                    }`}
                  >
                    {/* Checkbox */}
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        selected
                          ? "border-brand bg-brand text-white"
                          : "border-[var(--border-light)]"
                      }`}
                    >
                      {selected && (
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>

                    {/* Image */}
                    {stepItem.menuItem.imageUrl && (
                      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 relative">
                        <Image
                          src={stepItem.menuItem.imageUrl}
                          alt={stepItem.menuItem.name}
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      </div>
                    )}

                    {/* Name & description */}
                    <div className="flex-1 text-start">
                      <p className="font-medium text-sm text-[var(--text-primary)]">
                        {stepItem.menuItem.name}
                      </p>
                      {stepItem.menuItem.description && (
                        <p className="text-xs text-[var(--text-muted)] line-clamp-1">
                          {stepItem.menuItem.description}
                        </p>
                      )}
                    </div>

                    {/* Price delta */}
                    {stepItem.priceDelta > 0 && (
                      <span className="text-xs font-semibold text-brand flex-shrink-0">
                        +{currencySymbol(currency)}
                        {stepItem.priceDelta.toFixed(2)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[var(--border-light)] bg-[var(--surface-card)]">
          <div className="flex gap-3">
            {currentStepIdx > 0 && (
              <button
                type="button"
                onClick={() => setCurrentStepIdx((i) => i - 1)}
                className="flex-1 py-3 rounded-xl border border-[var(--border-light)] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition-colors"
              >
                Back
              </button>
            )}
            <button
              type="button"
              disabled={!isStepValid}
              onClick={handleNext}
              className={`flex-[2] py-3 rounded-xl font-bold text-white transition-colors ${
                isStepValid
                  ? "bg-brand hover:bg-brand/90"
                  : "bg-gray-300 cursor-not-allowed"
              }`}
            >
              {isLastStep
                ? `Add to cart · ${currencySymbol(currency)}${(combo.price + extraDelta).toFixed(2)}`
                : `Next (${currentStepIdx + 1}/${totalSteps})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
