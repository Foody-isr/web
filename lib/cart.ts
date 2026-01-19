import { CartLine, MenuItemModifier } from "@/lib/types";

export function modifiersDelta(modifiers?: MenuItemModifier[]) {
  if (!modifiers || modifiers.length === 0) {
    return 0;
  }
  return modifiers.reduce((sum, mod) => sum + (mod.priceDelta ?? 0), 0);
}

export function lineUnitPrice(line: CartLine) {
  return line.item.price + modifiersDelta(line.modifiers);
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
