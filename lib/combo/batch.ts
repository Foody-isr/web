import type { ComboMenu, ComboStep, ComboCartSelection } from "../types";

/** Normalize a size label for case/whitespace-insensitive matching, mirroring
 *  the server's combo resolver. */
export function normSizeLabel(s: string): string {
  return s.trim().toLowerCase();
}

/** Hard ceiling on how many of one combo a guest can order in a single batch. */
export const MAX_COMBO_QUANTITY = 10;

/** Clamp/normalise a requested combo quantity into the allowed 1..MAX range. */
export function clampComboQuantity(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(MAX_COMBO_QUANTITY, Math.floor(n)));
}

/** Index of the first step that needs a real customer choice (else 0). */
export function firstChoiceStepIdx(combo: ComboMenu): number {
  // All-preset combos (every step single-item × N) return 0; such combos are
  // routed straight to the cart and never enter the builder that uses this.
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

/** Sum of quantities in a step whose picks use a given size label (matched by
 *  the selection's option name, case/whitespace-insensitive). */
export function batchStepSizePicks(
  selections: ComboCartSelection[],
  stepId: number,
  label: string,
): number {
  const want = normSizeLabel(label);
  return selections
    .filter((s) => s.stepId === stepId && normSizeLabel(s.optionName ?? "") === want)
    .reduce((sum, s) => sum + s.quantity, 0);
}

/** True when every per-size rule on the step is satisfied for an N-batch:
 *  each size's picks fall within [minPicks × n, maxPicks × n] (max 0 = no cap).
 *  Steps without rules are trivially ok. */
export function batchStepSizeRulesOk(
  step: ComboStep,
  selections: ComboCartSelection[],
  n: number,
): boolean {
  if (!step.variantRules?.length) return true;
  const m = clampComboQuantity(n);
  return step.variantRules.every((r) => {
    const picks = batchStepSizePicks(selections, step.id, r.variantLabel);
    if (r.minPicks > 0 && picks < r.minPicks * m) return false;
    if (r.maxPicks > 0 && picks > r.maxPicks * m) return false;
    return true;
  });
}

/** True when every step has picks within [minPicks × n, maxPicks × n] AND every
 *  per-size rule is satisfied. */
export function batchComplete(combo: ComboMenu, selections: ComboCartSelection[], n: number): boolean {
  const m = clampComboQuantity(n);
  return combo.steps.every((step) => {
    const picks = batchStepPicks(selections, step.id);
    if (picks < step.minPicks * m || picks > step.maxPicks * m) return false;
    return batchStepSizeRulesOk(step, selections, m);
  });
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
 *
 * Precondition: the aggregate should satisfy batchComplete(combo, selections, n).
 * If it is out of range, per-combo counts may fall outside [minPicks, maxPicks].
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
