"use client";
import { create } from "zustand";

export type WebsiteOrderSelection = {
  orderType: "pickup" | "delivery";
  address?: string;
};

/** Carries the service selection into checkout in memory, scoped to its restaurant. */
export const useWebsiteOrderStore = create<{
  selections: Record<string, WebsiteOrderSelection>;
  select: (restaurantId: string, selection: WebsiteOrderSelection) => void;
}>()((set) => ({
  selections: {},
  select: (restaurantId, selection) =>
    set((state) => ({
      selections: { ...state.selections, [restaurantId]: selection },
    })),
}));
