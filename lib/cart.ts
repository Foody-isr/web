import { CartLine, MenuItemModifier } from "@/lib/types";

/**
 * Calculate the total price delta for a set of selected modifiers,
 * taking into account group-level "included free" pricing.
 *
 * When a modifier group has freeQuantity > 0, the first N selections
 * in that group are free (priceDelta ignored), and subsequent ones
 * cost extraPrice each (or priceDelta if extraPrice is 0).
 */
export function modifiersDelta(modifiers?: MenuItemModifier[]) {
  if (!modifiers || modifiers.length === 0) {
    return 0;
  }

  // Group selected modifiers by category to apply free-quantity logic per group
  const groups: Record<string, MenuItemModifier[]> = {};
  for (const mod of modifiers) {
    const key = mod.category?.trim() || "__default__";
    (groups[key] ??= []).push(mod);
  }

  let total = 0;
  for (const mods of Object.values(groups)) {
    const freeQty = mods[0]?.freeQuantity ?? 0;
    if (freeQty > 0) {
      // Group pricing: first freeQty are free, extras cost extraPrice
      const extraPrice = mods[0]?.extraPrice ?? 0;
      const chargeableCount = Math.max(0, mods.length - freeQty);
      total += chargeableCount * extraPrice;
    } else {
      // Normal pricing: sum priceDelta for each modifier
      total += mods.reduce((sum, m) => sum + (m.priceDelta ?? 0), 0);
    }
  }
  return total;
}

export function lineUnitPrice(line: CartLine) {
  const basePrice = line.selectedVariantPrice ?? line.item.price;
  return basePrice + modifiersDelta(line.modifiers);
}

export function lineTotal(line: CartLine) {
  return lineUnitPrice(line) * line.quantity;
}

export function formatModifierLabel(mod: MenuItemModifier) {
  const label = mod.name?.trim() || "Modifier";
  if (mod.action === "remove") {
    return label.toLowerCase().startsWith("no ") ? label : `No ${label}`;
  }
  return label;
}
