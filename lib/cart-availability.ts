import type { CartLine, MenuItem } from "./types";

/** Maximum quantity for an item after accounting for its other cart lines.
 * Exclude the edited line so its current quantity can be replaced. Unknown
 * counts remain unlimited; fresh availability is still checked by the server. */
export function cartItemQuantityLimit(
  item: MenuItem,
  lines: CartLine[],
  excludeLineId?: string,
): number {
  if (item.available === false || item.availabilityState === "sold_out" || item.availabilityState === "hidden") {
    return 0;
  }
  if (item.buildableCount == null) return Infinity;
  const used = lines.reduce((sum, line) => {
    if (line.id === excludeLineId) return sum;
    if (line.comboId != null) {
      const selected = (line.comboSelections ?? []).reduce((count, selection) =>
        count + (String(selection.menuItemId) === item.id ? selection.quantity * line.quantity : 0), 0);
      return sum + selected;
    }
    return sum + (line.item.id === item.id ? line.quantity : 0);
  }, 0);
  return Math.max(0, Math.floor(item.buildableCount - used));
}

/** Recipe-aware availability for a single item, as exposed by the public menu API
 *  (`availabilityState` + `buildableCount`). `available === false` mirrors the
 *  legacy `is_active` flag and is treated the same as a sold-out state. */
export type ItemAvailability = {
  state?: "available" | "low" | "sold_out" | "hidden";
  buildableCount?: number | null;
  available?: boolean;
};

/** Result of cross-checking one cart line against fresh menu availability.
 *  `insufficient.available` is always >= 1 and strictly below the requested quantity. */
export type LineAvailability =
  | { status: "ok" }
  | { status: "sold_out" }
  | { status: "insufficient"; available: number };

/**
 * Classifies a cart line against the restaurant's current item availability so the
 * checkout can flag (and offer to fix) lines that can no longer be fulfilled.
 *
 * Combo lines resolve against the combo's rolled-up `sold_out` state; component
 * counts remain the server guard's responsibility. Items absent from the fresh menu
 * pass through as `ok` — the server-side availability guard is the authoritative
 * safety net for those.
 *
 * @param line The cart line to check.
 * @param availability Map of item id → current availability, built from `fetchMenu`.
 */
export function computeLineAvailability(
  line: CartLine,
  availability: Map<string, ItemAvailability>,
): LineAvailability {
  // Combo lines look up the combo's own rolled-up state (the server marks a combo
  // sold_out when a required step is fully out). Component-level counts stay the
  // server guard's job — only the sold_out roll-up gates here.
  const key = line.comboId != null ? String(line.comboId) : line.item.id;
  const info = availability.get(key);
  // Item/combo vanished from the menu between adding and checkout — let the server decide.
  if (!info) return { status: "ok" };

  if (info.available === false || info.state === "sold_out" || info.state === "hidden") {
    return { status: "sold_out" };
  }

  if (line.comboId != null) return { status: "ok" };

  const count = info.buildableCount;
  if (count != null && count < line.quantity) {
    if (count <= 0) return { status: "sold_out" };
    return { status: "insufficient", available: count };
  }

  return { status: "ok" };
}
