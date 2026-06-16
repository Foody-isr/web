import { CartLine, MenuItem, MenuItemModifier } from "@/lib/types";
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

/**
 * Effective price range shown on an item card. Items can carry their price on
 * size/variant options while the base `price` stays 0 (e.g. a salad sold only
 * as 250ml/500ml). The card would then read ₪0.00 even though the modal shows
 * real prices. Mirror the modal's pricing: the price-driving option set is the
 * first set that has options, and each option's effective price is
 * `onlinePrice ?? price`, falling back to the item base when that is 0. Returns
 * the min/max across that set so the card can render a single price or a range.
 */
export function itemDisplayPriceRange(item: MenuItem): { min: number; max: number } {
  const priceSet = (item.optionSets ?? []).find((os) => os.options.length > 0);
  if (priceSet) {
    const prices = priceSet.options.map((o) => {
      const raw = o.onlinePrice ?? o.price;
      return raw > 0 ? raw : item.price;
    });
    if (prices.length > 0) {
      return { min: Math.min(...prices), max: Math.max(...prices) };
    }
  }
  return { min: item.price, max: item.price };
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
  // Conversational verb wins when present (e.g. "Sans Oeuf", "בלי בצל").
  if (mod.operator) {
    return operatorDisplayName(mod.operator, label, locale);
  }
  if (mod.action === "remove") {
    return label.toLowerCase().startsWith("no ") ? label : `No ${label}`;
  }
  return label;
}
