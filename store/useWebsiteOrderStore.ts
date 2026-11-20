"use client";
import type { DeliveryAddressSuggestion } from "@/services/api";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type WebsiteOrderSelection = {
  orderType: "pickup" | "delivery";
  /** Page whose separate service step confirmed this selection. */
  cataloguePage?: string;
  address?: string;
  addressSelection?: DeliveryAddressSuggestion;
  /** Keeps the reviewed fulfillment slot when returning from cart to menu. */
  schedulingIntent?: { scheduledFor: string; selectedSlot: { start: string; end: string } } | null;
};

/** Carries the service selection into checkout in this tab, scoped to its restaurant and current cart. */
export const useWebsiteOrderStore = create<{
  selections: Record<string, WebsiteOrderSelection>;
  select: (restaurantId: string, selection: WebsiteOrderSelection) => void;
  clearAddresses: () => void;
  clearRestaurant: (restaurantId: string) => void;
}>()(persist((set) => ({
  selections: {},
  clearRestaurant: restaurantId => set(state => { const selections = { ...state.selections }; delete selections[restaurantId]; return { selections }; }),
  clearAddresses: () => set(state => ({ selections: Object.fromEntries(Object.entries(state.selections).map(([id, selection]) => [id, { orderType: selection.orderType, cataloguePage: selection.cataloguePage, schedulingIntent: selection.schedulingIntent }])) })),
  select: (restaurantId, selection) =>
    set((state) => ({
      selections: { ...state.selections, [restaurantId]: selection },
    })),
}), { name: 'foody-website-cart-selection', storage: createJSONStorage(() => sessionStorage) }));
