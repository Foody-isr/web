"use client";

import { useEffect, useRef } from "react";
import { GOOGLE_CLIENT_ID } from "@/lib/constants";
import { googleLogin } from "@/services/api";
import { useGuestAccount } from "@/store/useGuestAccount";

declare global {
  interface Window {
    google?: any;
  }
}

let gsiPromise: Promise<void> | null = null;

/** Load Google Identity Services once, memoized across mounts. */
function loadGsi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gsiPromise) return gsiPromise;
  gsiPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Google sign-in"));
    document.head.appendChild(s);
  });
  return gsiPromise;
}

/**
 * Renders Google's "Continue with Google" button. On success it stores the
 * guest session and calls onSignedIn.
 */
export function GoogleSignIn({ onSignedIn }: { onSignedIn?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const cbRef = useRef(onSignedIn);
  cbRef.current = onSignedIn;

  // Initialize and render Google's button once.
  useEffect(() => {
    let cancelled = false;
    loadGsi()
      .then(() => {
        if (cancelled || !window.google?.accounts?.id || !ref.current) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (resp: { credential?: string }) => {
            if (!resp?.credential) return;
            try {
              const { token, account } = await googleLogin(resp.credential);
              useGuestAccount.getState().setSession(token, account);
              cbRef.current?.();
            } catch (e) {
              console.error("Google sign-in failed", e);
            }
          },
        });
        window.google.accounts.id.renderButton(ref.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "continue_with",
          width: 240,
        });
      })
      .catch(() => {
        /* offline / blocked — button simply won't render */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <div ref={ref} className="flex justify-center" />;
}
