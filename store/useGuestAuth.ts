"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type GuestSession = {
  phone: string;
  proof: string;
  expiresAt: number;
  verifiedAt: number;
};

type GuestAuthStore = {
  sessions: Record<string, GuestSession>;
  setVerified: (restaurantId: string, phone: string, proof: string, expiresAt: string) => void;
  getSession: (restaurantId: string) => GuestSession | null;
  isVerified: (restaurantId: string) => boolean;
  getPhone: (restaurantId: string) => string | null;
  getProof: (restaurantId: string) => string | null;
  clearSession: (restaurantId: string) => void;
  clearAll: () => void;
};

export const useGuestAuth = create<GuestAuthStore>()(
  persist(
    (set, get) => ({
      sessions: {},

      setVerified: (restaurantId, phone, proof, expiresAt) =>
        set((state) => ({
          sessions: {
            ...state.sessions,
            [restaurantId]: {
              phone,
              proof,
              expiresAt: Date.parse(expiresAt),
              verifiedAt: Date.now(),
            },
          },
        })),

      getSession: (restaurantId) => {
        const session = get().sessions[restaurantId];
        if (!session?.proof || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) {
          return null;
        }
        return session;
      },

      isVerified: (restaurantId) => {
        return get().getSession(restaurantId) !== null;
      },

      getPhone: (restaurantId) => {
        const session = get().getSession(restaurantId);
        return session?.phone ?? null;
      },

      getProof: (restaurantId) => {
        const session = get().getSession(restaurantId);
        return session?.proof ?? null;
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
