"use client";
import { create } from "zustand";

export type WebsiteOrderSelection = {
  orderType: "pickup" | "delivery";
  address?: string;
  /** Keeps the reviewed fulfillment slot when returning from cart to menu. */
  schedulingIntent?: { scheduledFor: string; selectedSlot: { start: string; end: string } } | null;
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
