"use client";

import { useEffect, useRef, useState } from "react";
import { GOOGLE_CLIENT_ID } from "@/lib/constants";
import { googleLogin } from "@/services/api";
import { useGuestAccount } from "@/store/useGuestAccount";
import { useI18n } from "@/lib/i18n";

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
    s.onerror = () => { s.remove(); gsiPromise = null; reject(new Error("Failed to load Google sign-in")); };
    document.head.appendChild(s);
  });
  return gsiPromise;
}

/**
 * Renders Google's "Continue with Google" button. The opaque session is set
 * by the same-origin BFF as an HttpOnly cookie; only the safe profile is kept
 * in browser state.
 */
export function GoogleSignIn({ onSignedIn }: { onSignedIn?: () => void }) {
  const { t } = useI18n();
  const [error, setError] = useState(false);
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
              const { account } = await googleLogin(resp.credential);
              useGuestAccount.getState().setSession(account);
              cbRef.current?.();
            } catch {
              if (!cancelled) setError(true);
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
      .catch(() => { if (!cancelled) setError(true); });
    return () => {
      cancelled = true;
    };
  }, []);

  return <div className="space-y-2"><div ref={ref} className="flex justify-center" />{error && <p role="status" className="max-w-prose text-center text-xs leading-relaxed text-[var(--text-muted)]">{t("accountGoogleUnavailable")}</p>}</div>;
}
