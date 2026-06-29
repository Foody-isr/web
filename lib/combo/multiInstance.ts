import type { ComboMenu, ComboCartSelection } from "../types";

/** Hard ceiling on how many of one combo a guest can build in a single run. */
export const MAX_COMBO_QUANTITY = 10;

/** Clamp/normalise a requested combo quantity into the allowed 1..MAX range. */
export function clampComboQuantity(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(MAX_COMBO_QUANTITY, Math.floor(n)));
}

/**
 * Selections to pre-fill for ONE combo instance: steps that offer no real
 * choice (a single item × N picks) are filled automatically, exactly as the
 * legacy single-combo startCombo did. A sold-out single-item step is skipped so
 * we never silently pre-fill an unavailable item.
 */
export function initialInstanceSelections(combo: ComboMenu): ComboCartSelection[] {
  const out: ComboCartSelection[] = [];
  for (const step of combo.steps) {
    if (step.items.length === 1 && step.minPicks > 0) {
      const only = step.items[0];
      if (only.menuItem.availabilityState === "sold_out") continue;
      out.push({
        stepId: step.id,
        stepName: step.name,
        menuItemId: only.menuItemId,
        menuItemName: only.menuItem.name,
        optionId: only.optionId ?? null,
        quantity: step.minPicks,
        priceDelta: only.priceDelta,
      });
    }
  }
  return out;
}

/** Build `total` independent, pre-filled instance selection arrays. */
export function makeInitialInstances(combo: ComboMenu, total: number): ComboCartSelection[][] {
  const n = clampComboQuantity(total);
  const instances: ComboCartSelection[][] = [];
  for (let i = 0; i < n; i++) {
    // Fresh objects per instance so editing one never aliases another.
    instances.push(initialInstanceSelections(combo).map((s) => ({ ...s })));
  }
  return instances;
}

/** Index of the first step that still needs a real customer choice (else 0). */
export function firstChoiceStepIdx(combo: ComboMenu): number {
  const idx = combo.steps.findIndex((s) => !(s.items.length === 1 && s.minPicks > 0));
  return idx >= 0 ? idx : 0;
}

/** True when every step in this instance has at least its minPicks satisfied. */
export function instanceComplete(combo: ComboMenu, selections: ComboCartSelection[]): boolean {
  return combo.steps.every((step) => {
    const picks = selections
      .filter((s) => s.stepId === step.id)
      .reduce((sum, s) => sum + s.quantity, 0);
    return picks >= step.minPicks;
  });
}

/**
 * Return a new instances array where instance `index` is a deep copy of
 * instance `index - 1`. No-op (returns the same array) when there is no
 * previous instance.
 */
export function copyPreviousInstance(
  instances: ComboCartSelection[][],
  index: number,
): ComboCartSelection[][] {
  if (index <= 0 || index >= instances.length) return instances;
  const copy = instances.slice();
  copy[index] = (instances[index - 1] ?? []).map((s) => ({ ...s }));
  return copy;
}

/** Sum of priceDelta × quantity across one instance's selections. */
export function instanceExtraDelta(selections: ComboCartSelection[]): number {
  return selections.reduce((sum, s) => sum + s.priceDelta * s.quantity, 0);
}

/** Grand total for N instances: N × base price + every instance's deltas. */
export function instancesTotalPrice(combo: ComboMenu, instances: ComboCartSelection[][]): number {
  const base = instances.length * combo.price;
  const deltas = instances.reduce((sum, inst) => sum + instanceExtraDelta(inst), 0);
  return base + deltas;
}
