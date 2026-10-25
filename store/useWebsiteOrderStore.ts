"use client";
import type { DeliveryAddressSuggestion } from "@/services/api";
import { create } from "zustand";

export type WebsiteOrderSelection = {
  orderType: "pickup" | "delivery";
  address?: string;
  addressSelection?: DeliveryAddressSuggestion;
  /** Keeps the reviewed fulfillment slot when returning from cart to menu. */
  schedulingIntent?: { scheduledFor: string; selectedSlot: { start: string; end: string } } | null;
};

/** Carries the service selection into checkout in memory, scoped to its restaurant. */
export const useWebsiteOrderStore = create<{
  selections: Record<string, WebsiteOrderSelection>;
  select: (restaurantId: string, selection: WebsiteOrderSelection) => void;
  clearAddresses: () => void;
}>()((set) => ({
  selections: {},
  clearAddresses: () => set(state => ({ selections: Object.fromEntries(Object.entries(state.selections).map(([id, selection]) => [id, { orderType: selection.orderType, schedulingIntent: selection.schedulingIntent }])) })),
  select: (restaurantId, selection) =>
    set((state) => ({
      selections: { ...state.selections, [restaurantId]: selection },
    })),
}));
