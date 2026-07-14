import type { ComboMenu, ComboStep } from "@/lib/types";

/** How many times `menuItemId` may be picked within `step`, counted across all
 *  its sizes. 0 = unlimited. An itemLimits override wins over the step default. */
export function effectivePerItemCap(step: ComboStep, menuItemId: number): number {
  const override = step.itemLimits?.find((l) => l.menuItemId === menuItemId);
  return override ? override.maxQty : step.maxPerItem ?? 0;
}

/** True when the step leaves the customer nothing to decide: exactly one basket
 *  satisfies it. */
function isStepForced(step: ComboStep): boolean {
  if (step.items.length === 0) return false;
  if (step.minPicks <= 0) return false;
  if (step.minPicks !== step.maxPicks) return false;

  // Per-size rules let the customer pick a size for each item, which is a choice
  // even when the items themselves are forced.
  if (step.variantRules && step.variantRules.length > 0) return false;

  // One item, N picks: that item N times. Nothing to decide, cap irrelevant.
  if (step.items.length === 1) return true;

  // N items, N picks collapses to "one of each" ONLY if an item cannot be taken
  // twice. As soon as a repeat is allowed the customer can drop one item for a
  // second copy of another, so the picks are a real decision.
  if (step.items.length !== step.minPicks) return false;
  return step.items.every((i) => effectivePerItemCap(step, i.menuItemId) === 1);
}

/** A combo is "fixed" when no step leaves the customer a choice, so the entry
 *  flow can add it straight to the cart instead of opening the step builder. */
export function isFixedComboShape(combo: ComboMenu): boolean {
  if (combo.steps.length === 0) return false;
  return combo.steps.every(isStepForced);
}
