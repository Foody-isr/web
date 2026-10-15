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
  const { t, locale } = useI18n();
  const [error, setError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cbRef = useRef(onSignedIn);
  cbRef.current = onSignedIn;

  // Keep Google's own button aligned with the form, including narrow screens.
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
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
        const container = ref.current;
        let renderedWidth = 0;
        const render = (availableWidth: number) => {
          const width = Math.min(400, Math.floor(availableWidth));
          if (cancelled || width <= 0 || width === renderedWidth) return;
          renderedWidth = width;
          container.replaceChildren();
          window.google.accounts.id.renderButton(container, {
            type: "standard",
            theme: "outline",
            size: "large",
            shape: "rectangular",
            text: "continue_with",
            locale,
            width,
          });
        };
        render(container.clientWidth);
        observer = new ResizeObserver(([entry]) => render(entry.contentRect.width));
        observer.observe(container);
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [locale]);

  // A light Google iframe in an inherited dark color scheme gets an opaque
  // browser canvas. Match its scheme here so the extra white rectangle vanishes.
  return <div className="w-full space-y-2" data-google-sign-in><div ref={ref} className="mx-auto flex w-full max-w-[400px] justify-center [color-scheme:light]" />{error && <p role="status" className="max-w-prose text-center text-xs leading-relaxed text-[var(--text-muted)]">{t("accountGoogleUnavailable")}</p>}</div>;
}
