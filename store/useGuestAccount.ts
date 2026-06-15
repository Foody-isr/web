"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type GuestAccount = {
  id: number;
  email: string;
  name: string;
  picture?: string;
  phone?: string;
  // Saved delivery address (set from past delivery orders / edited in the admin),
  // used to autofill the checkout for returning signed-in guests.
  address?: string;
  city?: string;
  floor?: string;
  apt?: string;
  delivery_notes?: string;
};

type GuestAccountState = {
  token: string | null;
  account: GuestAccount | null;
  setSession: (token: string, account: GuestAccount) => void;
  /** Refresh the cached account (e.g. phone backfilled from past orders). */
  setAccount: (account: GuestAccount) => void;
  signOut: () => void;
};

/**
 * Passwordless guest identity from social sign-in (Google). Persisted so a
 * returning guest stays signed in and can reorder. `token` is a server-issued
 * guest JWT, sent as a Bearer header on chat / order / history calls.
 *
 * Note: distinct from `useGuestAuth` (which tracks OTP phone-verification
 * sessions for checkout).
 */
export const useGuestAccount = create<GuestAccountState>()(
  persist(
    (set) => ({
      token: null,
      account: null,
      setSession: (token, account) => set({ token, account }),
      setAccount: (account) => set({ account }),
      signOut: () => set({ token: null, account: null }),
    }),
    { name: "foody-guest-account" }
  )
);
