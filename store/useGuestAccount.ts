"use client";

import { create } from "zustand";
import { useWebsiteOrderStore } from "@/store/useWebsiteOrderStore";

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
let sessionVersion = 0;

/**
 * Browser-visible customer profile state. The actual session credential lives
 * only in a same-origin HttpOnly cookie managed by Next.js route handlers.
 */
export const useGuestAccount = create<GuestAccountState>((set, get) => ({
  account: null,
  status: "loading",
  setSession: (account) => {
    if (get().account && get().account?.id !== account.id) useWebsiteOrderStore.getState().clearAddresses();
    sessionVersion++;
    set({ account, status: "authenticated" });
  },
  setAccount: (account) => {
    sessionVersion++;
    set({ account, status: "authenticated" });
  },
  hydrateSession: async () => {
    if (hydrationPromise) return hydrationPromise;
    const version = sessionVersion;
    hydrationPromise = (async () => {
      try {
        // Remove the pre-BFF Zustand payload, which could contain the legacy
        // browser-readable bearer token. New sessions never enter Web Storage.
        window.localStorage.removeItem("foody-guest-account");
        const response = await fetch("/api/customer-auth/session", {
          cache: "no-store",
          credentials: "same-origin",
        });
        const data = response.ok ? (await response.json()) as { account?: GuestAccount } : null;
        if (version !== sessionVersion) return;
        if (data?.account)
          set({ account: data.account, status: "authenticated" });
        else set({ account: null, status: "anonymous" });
      } catch {
        if (version === sessionVersion) set({ account: null, status: "anonymous" });
      }
    })().finally(() => {
      hydrationPromise = null;
    });
    return hydrationPromise;
  },
  signOut: async () => {
    const response = await fetch("/api/customer-auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
    if (response.status !== 204) throw new Error("Customer sign-out was not confirmed.");
    sessionVersion++;
    useWebsiteOrderStore.getState().clearAddresses();
    set({ account: null, status: "anonymous" });
  },
}));
