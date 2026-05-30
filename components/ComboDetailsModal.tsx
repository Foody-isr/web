"use client";

import { ComboMenu, ComboCartSelection } from "@/lib/types";
import { currencySymbol } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import { useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

/** A combo is "fixed" (no customer choice) when every step is either a single
 *  item × N quantity, or a bundle of N items × 1 each. Exported so callers can
 *  branch the entry flow (fixed → add straight to cart, custom → step drawer). */
export function isFixedComboShape(combo: ComboMenu): boolean {
  if (combo.steps.length === 0) return false;
  return combo.steps.every((s) => {
    if (s.items.length === 0) return false;
    if (s.minPicks <= 0) return false;
    if (s.minPicks !== s.maxPicks) return false;
    return s.items.length === 1 || s.items.length === s.minPicks;
  });
}

/** Build the cart selections for a fully-fixed combo (no customer choices). */
function buildFixedSelections(combo: ComboMenu): ComboCartSelection[] {
  const out: ComboCartSelection[] = [];
  for (const step of combo.steps) {
    if (step.items.length === 0) continue;
    // Single item × N → one selection with quantity N.
    // Bundle of N items × 1 each → N selections, quantity 1.
    const perItemQty = step.items.length === 1 ? step.minPicks : 1;
    for (const item of step.items) {
      out.push({
        stepId: step.id,
        stepName: step.name,
        menuItemId: item.menuItemId,
        menuItemName: item.menuItem.name,
        optionId: item.optionId ?? null,
        quantity: perItemQty,
        priceDelta: item.priceDelta,
      });
    }
  }
  return out;
}

type Props = {
  combo: ComboMenu | null;
  currency: string;
  onClose: () => void;
  /** Custom combos: tapping "Build your combo" enters the step drawer. */
  onStartCustom?: (combo: ComboMenu) => void;
  /** Fixed combos: tapping "Add to cart" adds the bundle straight to the cart. */
  onAddFixed?: (
    comboId: number,
    comboName: string,
    comboPrice: number,
    selections: ComboCartSelection[]
  ) => void;
  /** Quick-view mode (opened from inside the drawer): hero + description only,
   *  no footer action. Closing returns to the wizard with selections intact. */
  readOnly?: boolean;
};

/**
 * Unified combo entry modal — the front door for every combo tap. Shows the
 * combo's hero image, name, description and price like a normal product, then:
 *
 *   • fixed combo   → "What's included" list  + [ Add to cart ]
 *   • custom combo  → step-preview chips       + [ Build your combo ] → step drawer
 *   • readOnly      → hero + description only  (in-drawer quick view)
 */
export function ComboDetailsModal({
  combo,
  currency,
  onClose,
  onStartCustom,
  onAddFixed,
  readOnly = false,
}: Props) {
  const { t } = useI18n();
  const isFixed = combo ? isFixedComboShape(combo) : false;

  const handleAddFixed = useCallback(() => {
    if (!combo || !onAddFixed) return;
    onAddFixed(combo.id, combo.name, combo.price, buildFixedSelections(combo));
    onClose();
  }, [combo, onAddFixed, onClose]);

  const handleStart = useCallback(() => {
    if (!combo || !onStartCustom) return;
    onStartCustom(combo);
    onClose();
  }, [combo, onStartCustom, onClose]);

  return (
    <AnimatePresence>
      {combo && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 48, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 48, opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[var(--surface-elevated)] overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Hero image — kept compact (and capped against the viewport) so
                the step chips / "What's included" stay above the fold without
                scrolling on shorter screens. */}
            <div className="relative h-48 sm:h-56 max-h-[38vh] bg-[var(--surface-subtle)] flex-shrink-0">
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
                className="absolute top-3 end-3 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
                aria-label={t("close")}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body — scrolls when content is tall (long included list). */}
            <div className="flex-1 overflow-y-auto px-5 pt-4 pb-2">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-bold text-xl text-[var(--text)] leading-tight">
                  {combo.name}
                </h2>
                <span className="font-bold text-lg text-brand tabular-nums shrink-0">
                  {currencySymbol(currency)}{combo.price.toFixed(2)}
                </span>
              </div>
              {combo.description && (
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line mt-2">
                  {combo.description}
                </p>
              )}

              {/* Custom combo (not read-only): preview the steps ahead so the
                  guest knows there is a short build process. Pre-set steps
                  (single item × N picks) are tagged so the customer can see at
                  a glance what's already included — e.g. "Halotes ✓ ×2". */}
              {!readOnly && !isFixed && (
                <div className="mt-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2">
                    {t("comboStepsLabel")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {combo.steps.map((step, idx) => {
                      const isPreset = step.items.length === 1 && step.minPicks > 0;
                      return (
                        <span
                          key={step.id}
                          className={
                            "text-xs font-semibold px-3 py-1.5 rounded-full inline-flex items-center gap-1 " +
                            (isPreset
                              ? "text-green-500 bg-green-500/15"
                              : "text-brand bg-brand/10")
                          }
                        >
                          {isPreset && (
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                              aria-hidden
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          <span>{idx + 1} · {step.name}</span>
                          {isPreset && step.minPicks > 1 && (
                            <span className="opacity-80 tabular-nums">×{step.minPicks}</span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Fixed combo (not read-only): show exactly what's in the bundle. */}
              {!readOnly && isFixed && (
                <div className="mt-4">
                  <h3 className="font-bold text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2.5">
                    {t("comboWhatsIncluded")}
                  </h3>
                  <div className="space-y-3">
                    {combo.steps.map((step) => {
                      const isBundle = step.items.length > 1;
                      const perItemQty = isBundle ? 1 : step.minPicks;
                      return (
                        <div key={step.id} className="space-y-2">
                          {isBundle && step.name && (
                            <h4 className="text-xs font-bold uppercase tracking-wider text-brand/90">
                              {step.name}
                            </h4>
                          )}
                          {step.items.map((item, idx) => (
                            <div
                              key={`${step.id}-${item.id}-${idx}`}
                              className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-[var(--divider)] bg-[var(--surface)]"
                            >
                              <div className="w-9 h-9 rounded-lg bg-brand/10 text-brand font-bold text-sm flex items-center justify-center flex-shrink-0">
                                ×{perItemQty}
                              </div>
                              {item.menuItem.imageUrl && (
                                <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 relative">
                                  <Image
                                    src={item.menuItem.imageUrl}
                                    alt={item.menuItem.name}
                                    fill
                                    className="object-cover"
                                    sizes="48px"
                                  />
                                </div>
                              )}
                              <div className="flex-1 text-start min-w-0">
                                <p className="font-medium text-sm text-[var(--text)]">
                                  {item.menuItem.name}
                                </p>
                                {item.menuItem.description && (
                                  <p className="text-xs text-[var(--text-muted)] line-clamp-1">
                                    {item.menuItem.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer action — hidden in read-only quick-view. */}
            {!readOnly && (
              <div className="flex-shrink-0 px-5 pt-2 pb-[max(env(safe-area-inset-bottom,16px),16px)]">
                {isFixed ? (
                  <button
                    type="button"
                    onClick={handleAddFixed}
                    className="w-full py-3.5 rounded-xl font-bold text-white bg-brand shadow-lg shadow-brand/25 hover:brightness-110 active:scale-[0.98] transition-all"
                  >
                    {t("addToCart")} · {currencySymbol(currency)}{combo.price.toFixed(2)}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStart}
                    className="w-full py-3.5 rounded-xl font-bold text-white bg-brand shadow-lg shadow-brand/25 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    {t("comboBuildYours")}
                    <svg className="w-4 h-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
