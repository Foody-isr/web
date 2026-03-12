"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type GuestSession = {
  phone: string;
  verifiedAt: number;
};

type GuestAuthStore = {
  sessions: Record<string, GuestSession>;
  setVerified: (restaurantId: string, phone: string) => void;
  getSession: (restaurantId: string) => GuestSession | null;
  isVerified: (restaurantId: string) => boolean;
  getPhone: (restaurantId: string) => string | null;
  clearSession: (restaurantId: string) => void;
  clearAll: () => void;
};

export const useGuestAuth = create<GuestAuthStore>()(
  persist(
    (set, get) => ({
      sessions: {},

      setVerified: (restaurantId, phone) =>
        set((state) => ({
          sessions: {
            ...state.sessions,
            [restaurantId]: { phone, verifiedAt: Date.now() },
          },
        })),

      getSession: (restaurantId) => {
        return get().sessions[restaurantId] ?? null;
      },

      isVerified: (restaurantId) => {
        const session = get().sessions[restaurantId];
        return !!session;
      },

      getPhone: (restaurantId) => {
        const session = get().sessions[restaurantId];
        return session?.phone ?? null;
      },

      clearSession: (restaurantId) =>
        set((state) => {
          const { [restaurantId]: _, ...rest } = state.sessions;
          return { sessions: rest };
        }),

      clearAll: () => set({ sessions: {} }),
    }),
    { name: "foody-guest-auth" }
  )
);
