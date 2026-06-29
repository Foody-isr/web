import type { ComboMenu, ComboCartSelection } from "../types";

/** Hard ceiling on how many of one combo a guest can order in a single batch. */
export const MAX_COMBO_QUANTITY = 10;

/** Clamp/normalise a requested combo quantity into the allowed 1..MAX range. */
export function clampComboQuantity(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(MAX_COMBO_QUANTITY, Math.floor(n)));
}

/** Index of the first step that needs a real customer choice (else 0). */
export function firstChoiceStepIdx(combo: ComboMenu): number {
  const idx = combo.steps.findIndex((s) => !(s.items.length === 1 && s.minPicks > 0));
  return idx >= 0 ? idx : 0;
}

/**
 * Aggregated pre-fill for an N-batch: a no-choice step (single item × k picks)
 * is auto-filled with quantity k × n. Sold-out single-item steps are skipped so
 * we never silently pre-fill an unavailable item.
 */
export function initialBatchSelections(combo: ComboMenu, n: number): ComboCartSelection[] {
  const m = clampComboQuantity(n);
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
        quantity: step.minPicks * m,
        priceDelta: only.priceDelta,
      });
    }
  }
  return out;
}

/** Sum of quantities selected for one step. */
export function batchStepPicks(selections: ComboCartSelection[], stepId: number): number {
  return selections.filter((s) => s.stepId === stepId).reduce((sum, s) => sum + s.quantity, 0);
}

/** True when every step has at least minPicks × n picks. */
export function batchComplete(combo: ComboMenu, selections: ComboCartSelection[], n: number): boolean {
  const m = clampComboQuantity(n);
  return combo.steps.every((step) => batchStepPicks(selections, step.id) >= step.minPicks * m);
}

/** Sum of priceDelta × quantity across the aggregated selections. */
export function batchExtraDelta(selections: ComboCartSelection[]): number {
  return selections.reduce((sum, s) => sum + s.priceDelta * s.quantity, 0);
}

/** Total for an N-batch: n × base + all deltas. */
export function batchTotalPrice(combo: ComboMenu, selections: ComboCartSelection[], n: number): number {
  return clampComboQuantity(n) * combo.price + batchExtraDelta(selections);
}

/**
 * Split the aggregated batch into n per-combo selection arrays. For each step,
 * the picks are flattened into an ordered list of pick units, divided as evenly
 * as possible across the n combos (counts floor(T/n)/ceil(T/n)), and regrouped
 * into selections. When the aggregate is within [minPicks*n, maxPicks*n], each
 * combo lands within [minPicks, maxPicks].
 */
export function splitComboBatch(
  combo: ComboMenu,
  selections: ComboCartSelection[],
  n: number,
): ComboCartSelection[][] {
  const m = clampComboQuantity(n);
  const result: ComboCartSelection[][] = Array.from({ length: m }, () => []);

  for (const step of combo.steps) {
    const stepSels = selections.filter((s) => s.stepId === step.id);
    // Flatten into one unit per pick, carrying the source selection's metadata.
    const units: ComboCartSelection[] = [];
    for (const s of stepSels) {
      for (let i = 0; i < s.quantity; i++) units.push(s);
    }
    const total = units.length;
    const base = Math.floor(total / m);
    const remainder = total - base * m;
    let idx = 0;
    for (let c = 0; c < m; c++) {
      const count = base + (c < remainder ? 1 : 0);
      const chunk = units.slice(idx, idx + count);
      idx += count;
      // Regroup the chunk by (menuItemId, optionId) into selections with summed quantity.
      const byKey = new Map<string, ComboCartSelection>();
      for (const u of chunk) {
        const key = `${u.menuItemId}__${u.optionId ?? "null"}`;
        const existing = byKey.get(key);
        if (existing) existing.quantity += 1;
        else byKey.set(key, { ...u, quantity: 1 });
      }
      result[c].push(...byKey.values());
    }
  }
  return result;
}
