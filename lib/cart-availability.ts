import type { CartLine } from "./types";

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
 * Combo lines and items absent from the fresh menu pass through as `ok` — the
 * server-side availability guard remains the authoritative safety net for those.
 *
 * @param line The cart line to check.
 * @param availability Map of item id → current availability, built from `fetchMenu`.
 */
export function computeLineAvailability(
  line: CartLine,
  availability: Map<string, ItemAvailability>,
): LineAvailability {
  // Combos resolve their stock across multiple step items; the server guard owns
  // that case. Don't half-check it here.
  if (line.comboId != null) return { status: "ok" };

  const info = availability.get(line.item.id);
  // Item vanished from the menu between adding and checkout — let the server decide.
  if (!info) return { status: "ok" };

  if (info.available === false || info.state === "sold_out" || info.state === "hidden") {
    return { status: "sold_out" };
  }

  const count = info.buildableCount;
  if (count != null && count < line.quantity) {
    if (count <= 0) return { status: "sold_out" };
    return { status: "insufficient", available: count };
  }

  return { status: "ok" };
}
