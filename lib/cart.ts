import { CartLine, MenuItemModifier } from "@/lib/types";
import { tField } from "@/lib/translations";
import type { Locale } from "@/lib/i18n";
import {
  operatorDisplayName,
  operatorPriceDelta,
} from "@/lib/modifierOperator";

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
      // Normal pricing: each modifier charges according to its verb (free
      // verbs cost 0, "extra" uses extraPrice). Legacy modifiers without an
      // operator default to "add", preserving the previous priceDelta sum.
      total += mods.reduce(
        (sum, m) => sum + operatorPriceDelta(m, m.operator),
        0,
      );
    }
  }
  return total;
}

export function lineUnitPrice(line: CartLine) {
  // selectedVariantPrice of 0 means "same as item base" — operators use that
  // to express a choice that doesn't change the price (e.g. sauce on a pasta).
  // Only a positive variant price overrides the item base.
  const basePrice = line.selectedVariantPrice && line.selectedVariantPrice > 0
    ? line.selectedVariantPrice
    : line.item.price;
  return basePrice + modifiersDelta(line.modifiers);
}

export function lineTotal(line: CartLine) {
  return lineUnitPrice(line) * line.quantity;
}

export function formatModifierLabel(mod: MenuItemModifier, locale?: Locale) {
  const localized = locale ? tField(mod, "name", locale) : "";
  const label = (localized || mod.name || "").trim() || "Modifier";
  // Conversational verb wins when present (e.g. "Sans Oeuf", "Suppléments Thon").
  if (mod.operator) {
    return operatorDisplayName(mod.operator, label);
  }
  if (mod.action === "remove") {
    return label.toLowerCase().startsWith("no ") ? label : `No ${label}`;
  }
  return label;
}
