"use client";

import { create } from "zustand";

export type GuestAccount = {
  id: number;
  email: string;
  name: string;
  picture?: string;
  phone?: string;
  email_verified?: boolean;
  address?: string;
  city?: string;
  floor?: string;
  apt?: string;
  entry_code?: string;
  delivery_notes?: string;
};

export type CustomerSessionStatus = "loading" | "authenticated" | "anonymous";

type GuestAccountState = {
  account: GuestAccount | null;
  status: CustomerSessionStatus;
  setSession: (account: GuestAccount) => void;
  setAccount: (account: GuestAccount) => void;
  hydrateSession: () => Promise<void>;
  signOut: () => Promise<void>;
};

let hydrationPromise: Promise<void> | null = null;

/**
 * Browser-visible customer profile state. The actual session credential lives
 * only in a same-origin HttpOnly cookie managed by Next.js route handlers.
 */
export const useGuestAccount = create<GuestAccountState>((set) => ({
  account: null,
  status: "loading",
  setSession: (account) => set({ account, status: "authenticated" }),
  setAccount: (account) => set({ account, status: "authenticated" }),
  hydrateSession: async () => {
    if (hydrationPromise) return hydrationPromise;
    hydrationPromise = (async () => {
      try {
        // Remove the pre-BFF Zustand payload, which could contain the legacy
        // browser-readable bearer token. New sessions never enter Web Storage.
        window.localStorage.removeItem("foody-guest-account");
        const response = await fetch("/api/customer-auth/session", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) {
          set({ account: null, status: "anonymous" });
          return;
        }
        const data = (await response.json()) as { account?: GuestAccount };
        if (data.account)
          set({ account: data.account, status: "authenticated" });
        else set({ account: null, status: "anonymous" });
      } catch {
        set({ account: null, status: "anonymous" });
      }
    })().finally(() => {
      hydrationPromise = null;
    });
    return hydrationPromise;
  },
  signOut: async () => {
    try {
      await fetch("/api/customer-auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      set({ account: null, status: "anonymous" });
    }
  },
}));
