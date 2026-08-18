import type { ComboStep, ComboStepItem } from "@/lib/types";

/**
 * Whether one combo step entry can still be picked.
 *
 * The server stamps each step entry's own `menuItem.availabilityState`, and that
 * state already accounts for a pinned size: a step that forces "250g" reads the
 * 250g stock pool, not the salad's total. Entries the server could not compute
 * carry no state and stay pickable.
 */
export function isStepItemSoldOut(si: ComboStepItem): boolean {
  return si.menuItem?.availabilityState === "sold_out";
}

/**
 * Menu item ids (as card-key strings) that cannot be picked at all in this step
 * — every entry the step offers for them is sold out. A salad listed in two
 * sizes stays pickable while one size holds; the size picker grays the rest.
 */
export function soldOutStepItemIds(step: ComboStep | undefined): Set<string> {
  const out = new Set<string>();
  if (!step) return out;
  const pickable = new Set<string>();
  for (const si of step.items) {
    const key = String(si.menuItemId);
    if (isStepItemSoldOut(si)) out.add(key);
    else pickable.add(key);
  }
  for (const key of pickable) out.delete(key);
  return out;
}
