"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { GOOGLE_CLIENT_ID } from "@/lib/constants";
import { googleCodeLogin, googleLogin } from "@/services/api";
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
  if (window.google?.accounts?.id || window.google?.accounts?.oauth2) return Promise.resolve();
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

/** Opens Google's authorization popup from a Foody button. */
export function GoogleOAuthSignIn({ onSignedIn }: { onSignedIn?: () => void }) {
  const { t } = useI18n();
  const client = useRef<{ requestCode: () => void } | null>(null);
  const onSignedInRef = useRef(onSignedIn);
  onSignedInRef.current = onSignedIn;
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    void loadGsi().then(() => {
      if (!mounted) return;
      const oauth = window.google?.accounts?.oauth2;
      if (!oauth) {
        setError(true);
        return;
      }
      client.current = oauth.initCodeClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: "openid email profile",
        include_granted_scopes: false,
        ux_mode: "popup",
        callback: async ({ code, error }: { code?: string; error?: string }) => {
          if (!mounted) return;
          try {
            if (error === "access_denied") return;
            if (!code) throw new Error("Missing Google authorization code");
            const { account } = await googleCodeLogin(code);
            useGuestAccount.getState().setSession(account);
            if (mounted) onSignedInRef.current?.();
          } catch {
            if (mounted) setError(true);
          } finally {
            if (mounted) setBusy(false);
          }
        },
        error_callback: ({ type }: { type: string }) => {
          if (!mounted) return;
          setBusy(false);
          setError(type !== "popup_closed");
        },
      });
      setReady(true);
    }).catch(() => { if (mounted) setError(true); });
    return () => { mounted = false; client.current = null; };
  }, []);

  function signIn() {
    if (!client.current || busy) return;
    setError(false);
    setBusy(true);
    // Opening the popup must stay within the user's click.
    try {
      client.current.requestCode();
    } catch {
      setBusy(false);
      setError(true);
    }
  }

  return <div data-google-sign-in>
    <button type="button" data-social-provider="google" className="commerce-secondary customer-auth-choice"
      disabled={!ready || busy} onClick={signIn}>
      <Image src="/sign-in/google-g.png" width={24} height={24} alt="" className="rounded-full bg-white object-contain p-[3px]" />
      <span>{t(busy ? "loading" : "accountContinueGoogle")}</span>
    </button>
    {error && <p role="status" className="mt-2 text-center text-xs text-[var(--text-muted)]">{t("accountGoogleUnavailable")}</p>}
  </div>;
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
