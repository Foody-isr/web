"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CartLine, MenuItem, MenuItemModifier } from "@/lib/types";
import { lineTotal } from "@/lib/cart";

type CartStore = {
  restaurantId?: string;
  currency: string;
  lines: CartLine[];
  setContext: (restaurantId: string, currency: string) => void;
  addItem: (
    item: MenuItem,
    quantity: number,
    note?: string,
    modifiers?: MenuItemModifier[]
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
      setContext: (restaurantId, currency) =>
        set((state) => {
          if (state.restaurantId && state.restaurantId !== restaurantId) {
            return { restaurantId, currency, lines: [] };
          }
          return { restaurantId, currency };
        }),
      addItem: (item, quantity, note, modifiers) =>
        set((state) => {
          const nextLine: CartLine = {
            id: createLineId(),
            item,
            quantity,
            note,
            modifiers
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
      clear: () => set({ lines: [] }),
      total: () => get().lines.reduce((sum, line) => sum + lineTotal(line), 0)
    }),
    {
      name: "foody-cart"
    }
  )
);
