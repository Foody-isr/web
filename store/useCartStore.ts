"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CartLine, ComboCartSelection, MenuItem, MenuItemModifier } from "@/lib/types";
import { lineTotal } from "@/lib/cart";
import { cartItemQuantityLimit } from "@/lib/cart-availability";

type CartStore = {
  restaurantId?: string;
  currency: string;
  lines: CartLine[];

  setContext: (restaurantId: string, currency: string) => void;

  addItem: (
    item: MenuItem,
    quantity: number,
    note?: string,
    modifiers?: MenuItemModifier[],
    selectedVariantId?: number,
    selectedVariantName?: string,
    selectedVariantPrice?: number,
    selectedVariantNote?: string,
    optionSelections?: import("@/lib/types").OptionSelection[],
    sourceMenuId?: number
  ) => void;
  addCombo: (
    comboId: number,
    comboName: string,
    comboPrice: number,
    selections: ComboCartSelection[],
    quantity?: number,
    orderBatch?: ComboCartSelection[][],
    sourceMenuId?: number
  ) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  /** Atomically replaces an edited line while preserving its cart identity. */
  replaceItem: (lineId: string, line: Omit<CartLine, "id">) => void;
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

/** Preserve ordinary carts across upgrades and discard lines bound to a retired sales menu. */
export function migrateGuestCart(persisted: unknown) {
  const { tourId, tourSlug, ...cart } = (persisted ?? {}) as CartStore & { tourId?: number; tourSlug?: string };
  return tourId != null || tourSlug ? { ...cart, lines: [] } : cart;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      restaurantId: undefined,
      currency: "USD",
      lines: [],
      setContext: (restaurantId, currency) =>
        set((state) => {
          if (state.restaurantId && state.restaurantId !== restaurantId) {
            return { restaurantId, currency, lines: [] };
          }
          return { restaurantId, currency };
        }),
      addItem: (item, quantity, note, modifiers, selectedVariantId, selectedVariantName, selectedVariantPrice, selectedVariantNote, optionSelections, sourceMenuId) =>
        set((state) => {
          const nextQuantity = Math.min(Math.floor(quantity), cartItemQuantityLimit(item, state.lines));
          if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) return {};
          const nextLine: CartLine = {
            id: createLineId(),
            item,
            sourceMenuId,
            quantity: nextQuantity,
            note,
            modifiers,
            selectedVariantId,
            selectedVariantName,
            selectedVariantPrice,
            selectedVariantNote,
            optionSelections,
          };
          return { lines: [...state.lines, nextLine] };
        }),
      addCombo: (comboId, comboName, comboPrice, selections, quantity = 1, orderBatch, sourceMenuId) =>
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
            sourceMenuId,
            comboName,
            comboSelections: selections,
            ...(orderBatch && orderBatch.length > 1 ? { comboOrderBatch: orderBatch } : {}),
          };
          return { lines: [...state.lines, nextLine] };
        }),
      updateQuantity: (lineId, quantity) =>
        set((state) => {
          if (!Number.isFinite(quantity)) return {};
          return {
            lines: state.lines.map((line) => {
              if (line.id !== lineId) return line;
              const limit = line.comboId != null ? Infinity : cartItemQuantityLimit(line.item, state.lines, lineId);
              return { ...line, quantity: Math.min(Math.floor(quantity), limit) };
            }).filter((line) => line.quantity > 0),
          };
        }),
      replaceItem: (lineId, line) =>
        set((state) => {
          const limit = line.comboId != null ? Infinity : cartItemQuantityLimit(line.item, state.lines, lineId);
          const quantity = Math.min(Math.floor(line.quantity), limit);
          if (!Number.isFinite(quantity) || quantity <= 0) return {};
          return { lines: state.lines.map((current) => current.id === lineId ? { ...line, sourceMenuId:line.sourceMenuId ?? current.sourceMenuId, quantity, id: lineId } : current) };
        }),
      removeItem: (lineId) =>
        set((state) => ({ lines: state.lines.filter((line) => line.id !== lineId) })),
      clear: () => set({ lines: [] }),
      total: () => get().lines.reduce((sum, line) => sum + lineTotal(line), 0)
    }),
    {
      name: "foody-cart",
      version: 2,
      migrate: migrateGuestCart,
    }
  )
);
