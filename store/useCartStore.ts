"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CartLine, MenuItem } from "@/lib/types";

type CartStore = {
  restaurantId?: string;
  currency: string;
  lines: CartLine[];
  setContext: (restaurantId: string, currency: string) => void;
  addItem: (item: MenuItem, quantity: number, note?: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  removeItem: (itemId: string) => void;
  clear: () => void;
  total: () => number;
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
      addItem: (item, quantity, note) =>
        set((state) => {
          const existing = state.lines.find((line) => line.item.id === item.id);
          if (existing) {
            return {
              lines: state.lines.map((line) =>
                line.item.id === item.id
                  ? { ...line, quantity: line.quantity + quantity, note: note ?? line.note }
                  : line
              )
            };
          }
          return { lines: [...state.lines, { item, quantity, note }] };
        }),
      updateQuantity: (itemId, quantity) =>
        set((state) => ({
          lines: state.lines
            .map((line) => (line.item.id === itemId ? { ...line, quantity } : line))
            .filter((line) => line.quantity > 0)
        })),
      removeItem: (itemId) =>
        set((state) => ({ lines: state.lines.filter((line) => line.item.id !== itemId) })),
      clear: () => set({ lines: [] }),
      total: () => get().lines.reduce((sum, line) => sum + line.item.price * line.quantity, 0)
    }),
    {
      name: "foody-cart"
    }
  )
);
