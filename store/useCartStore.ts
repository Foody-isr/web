"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CartLine, ComboCartSelection, MenuItem, MenuItemModifier } from "@/lib/types";
import { lineTotal } from "@/lib/cart";

type CartStore = {
  restaurantId?: string;
  currency: string;
  lines: CartLine[];
  /**
   * The delivery tour this cart is for, when it was built from a tour's carte.
   * Undefined = ordinary cart.
   *
   * A tour order ships on a different day, to a different zone, at a different
   * fee and against a different minimum than an ordinary one. Mixing lines from
   * two cartes is harmless today (same day, same zone, same tariff); with a tour
   * it is wrong on all three counts, and the server rejects the order with
   * `tour_item_mismatch`. So tour lines and ordinary lines must never coexist.
   */
  tourId?: number;
  setContext: (restaurantId: string, currency: string) => void;
  /**
   * True when an item belonging to `tourId` can join the current cart as-is.
   * An empty cart accepts anything; a non-empty one only accepts its own tour.
   * Call this BEFORE addItem/addCombo — the add functions do not enforce it,
   * because only the caller can ask the guest whether to drop the current cart.
   */
  canAdd: (tourId?: number) => boolean;
  /**
   * Bind the cart to a tour (or, with no argument, to no tour at all).
   *
   * DESTRUCTIVE: changing the tour clears the lines, because they belong to the
   * old carte. Callers must gate on `canAdd()` and confirm with the guest first.
   * Re-binding to the tour the cart already carries is a no-op, so this is safe
   * to call on every render of a tab that is already active.
   */
  setTour: (tourId?: number) => void;
  addItem: (
    item: MenuItem,
    quantity: number,
    note?: string,
    modifiers?: MenuItemModifier[],
    selectedVariantId?: number,
    selectedVariantName?: string,
    selectedVariantPrice?: number
  ) => void;
  addCombo: (
    comboId: number,
    comboName: string,
    comboPrice: number,
    selections: ComboCartSelection[],
    quantity?: number,
    orderBatch?: ComboCartSelection[][]
  ) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  removeItem: (lineId: string) => void;
  clear: () => void;
  total: () => number;
};

const createLineId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `line-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      restaurantId: undefined,
      currency: "USD",
      lines: [],
      tourId: undefined,
      setContext: (restaurantId, currency) =>
        set((state) => {
          if (state.restaurantId && state.restaurantId !== restaurantId) {
            // Switching restaurant drops the cart, and the tour with it: a tour
            // belongs to the restaurant that runs it.
            return { restaurantId, currency, lines: [], tourId: undefined };
          }
          return { restaurantId, currency };
        }),
      canAdd: (tourId) => {
        const state = get();
        return state.lines.length === 0 || state.tourId === tourId;
      },
      setTour: (tourId) =>
        set((state) => (state.tourId === tourId ? {} : { tourId, lines: [] })),
      addItem: (item, quantity, note, modifiers, selectedVariantId, selectedVariantName, selectedVariantPrice) =>
        set((state) => {
          const nextLine: CartLine = {
            id: createLineId(),
            item,
            quantity,
            note,
            modifiers,
            selectedVariantId,
            selectedVariantName,
            selectedVariantPrice,
          };
          return { lines: [...state.lines, nextLine] };
        }),
      addCombo: (comboId, comboName, comboPrice, selections, quantity = 1, orderBatch) =>
        set((state) => {
          const n = Math.max(1, Math.floor(quantity) || 1);
          const comboItem: MenuItem = {
            id: `combo-${comboId}`,
            name: comboName,
            price: comboPrice,
            groupId: "__combo__",
            itemType: "combo",
          };
          const extraDelta = selections.reduce(
            (sum, s) => sum + s.priceDelta * s.quantity,
            0
          );
          // Bake the full batch price into the line; keep line.quantity = 1 so cart
          // totals (unitPrice × quantity) are not double-counted.
          comboItem.price = comboPrice * n + extraDelta;
          const nextLine: CartLine = {
            id: createLineId(),
            item: comboItem,
            quantity: 1,
            comboId,
            comboName,
            comboSelections: selections,
            ...(orderBatch && orderBatch.length > 1 ? { comboOrderBatch: orderBatch } : {}),
          };
          return { lines: [...state.lines, nextLine] };
        }),
      updateQuantity: (lineId, quantity) =>
        set((state) => ({
          lines: state.lines
            .map((line) => (line.id === lineId ? { ...line, quantity } : line))
            .filter((line) => line.quantity > 0)
        })),
      removeItem: (lineId) =>
        set((state) => ({ lines: state.lines.filter((line) => line.id !== lineId) })),
      clear: () => set({ lines: [], tourId: undefined }),
      total: () => get().lines.reduce((sum, line) => sum + lineTotal(line), 0)
    }),
    {
      name: "foody-cart",
      version: 1,
      /**
       * A cart persisted before tours existed has no `tourId` key at all. It can
       * only ever be an ordinary cart, so pin the field explicitly rather than
       * leaning on the merge to leave it absent — a stale cart must not come back
       * as a tour cart, nor a tour cart's lines as ordinary ones.
       *
       * `!version`, not `version === 0`: an entry persisted before `version` was
       * introduced carries no version field at all, and zustand hands that to
       * `migrate` as `undefined`, never as 0.
       */
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as CartStore;
        if (!version) {
          return { ...state, tourId: undefined };
        }
        return state;
      }
    }
  )
);
