"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

/**
 * The `beforeinstallprompt` event, fired by Chromium browsers (Android Chrome,
 * desktop Chrome/Edge) when a PWA is installable. Not part of the standard DOM
 * lib types, so we declare the minimal shape we use.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    /** Set by PwaHead's early capture script so a prompt fired before React
     *  mounted isn't lost. See components/PwaHead.tsx. */
    __foodyDeferredInstall?: BeforeInstallPromptEvent;
  }
}

type Props = {
  /** Scopes the "dismissed" flag so a refusal only silences this restaurant. */
  restaurantId: string;
  /** Display name shown in the card copy (e.g. "Chez Léa"). May be empty —
   *  some restaurants have no name set, and the prompt must still show. */
  restaurantName?: string;
  /** Optional logo used as the card avatar; falls back to the name's initial. */
  logoUrl?: string;
};

const dismissKey = (restaurantId: string) => `foody.a2hs.dismissed.${restaurantId}`;

/**
 * InstallPrompt nudges guests to add the restaurant's PWA to their home screen.
 *
 * It renders ONLY at the post-order confirmation moment (peak intent), and only
 * when it can actually help:
 *   - already running standalone  → renders nothing
 *   - previously dismissed        → renders nothing (localStorage, per-restaurant)
 *   - Chromium (beforeinstallprompt captured) → a native "Install" button
 *   - iOS Safari (no install API) → visual "Share → Add to Home Screen" steps
 *
 * The two platform branches exist because iOS Safari exposes no programmatic
 * install; the only path there is guiding the user to the Share sheet.
 */
export function InstallPrompt({ restaurantId, restaurantName, logoUrl }: Props) {
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Already installed / launched as an app → nothing to offer.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari exposes standalone on navigator, not via matchMedia.
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setHidden(true);
      return;
    }

    // Respect a prior refusal for this restaurant.
    try {
      if (localStorage.getItem(dismissKey(restaurantId))) {
        setHidden(true);
        return;
      }
    } catch {
      // localStorage unavailable (private mode) — fall through and still offer.
    }

    // iOS Safari detection: iOS device, and NOT Chrome/Firefox for iOS (those
    // wrap WebKit but can't add to home screen from within the app).
    const ua = window.navigator.userAgent;
    const iOSDevice = /iphone|ipad|ipod/i.test(ua);
    const iOSSafari = iOSDevice && !/crios|fxios|edgios/i.test(ua);
    setIsIOS(iOSSafari);

    // The prompt may have fired (and been stashed by PwaHead) before this
    // component mounted — pick it up so the button still shows.
    if (window.__foodyDeferredInstall) {
      setDeferred(window.__foodyDeferredInstall);
    }

    const onBeforeInstall = (e: Event) => {
      // Stop Chrome's mini-infobar; we drive the prompt from our own button.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setHidden(true);

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [restaurantId]);

  const handleInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    // The event is single-use; drop the stashed copy so it can't be reused.
    delete window.__foodyDeferredInstall;
    if (outcome === "accepted") setHidden(true);
  };

  const handleDismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(dismissKey(restaurantId), "1");
    } catch {
      // Best-effort; a non-persisted dismissal still hides it this session.
    }
  };

  // Avoid a hydration mismatch: nothing to show until we've probed the client.
  // Render only when a concrete branch applies (Chromium prompt or iOS Safari).
  if (!mounted || hidden || (!deferred && !isIOS)) return null;

  // Name is optional — some restaurants have none. Fall back gracefully so the
  // prompt still shows (this is exactly the case that hid it for mamie-tlv).
  const name = restaurantName?.trim() ?? "";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-brand bg-gradient-to-br from-brand/10 to-transparent p-4 shadow-sm">
      <button
        onClick={handleDismiss}
        aria-label={t("installDismiss")}
        className="absolute top-2.5 end-2.5 grid h-7 w-7 place-items-center rounded-full bg-black/5 text-[var(--text-muted)] hover:bg-black/10 transition"
      >
        ✕
      </button>

      <div className="flex items-center gap-3 mb-2.5">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            className="h-11 w-11 flex-none rounded-xl object-cover"
          />
        ) : (
          <div className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-brand text-white">
            {name ? (
              <span className="text-xl font-extrabold">{name.charAt(0).toUpperCase()}</span>
            ) : (
              // No name and no logo — a generic app glyph keeps the card intact.
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="4" y="2" width="16" height="20" rx="3" />
                <line x1="10" y1="18" x2="14" y2="18" />
              </svg>
            )}
          </div>
        )}
        <div className="pe-5">
          <h4 className="text-[15px] font-extrabold leading-tight">
            {t("installTitle")}
          </h4>
          <p className="mt-0.5 text-[12.5px] text-[var(--text-muted)]">
            {isIOS
              ? t("installSubtitleIOS")
              : name
                ? t("installSubtitle").replace("{name}", name)
                : t("installSubtitleGeneric")}
          </p>
        </div>
      </div>

      {deferred ? (
        <button
          onClick={handleInstall}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-bold text-white hover:bg-brand-dark active:scale-[0.98] transition-all"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 5v14m0 0-6-6m6 6 6-6" />
          </svg>
          {t("installCta")}
        </button>
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-3 text-[13px]">
            <span className="grid h-[22px] w-[22px] flex-none place-items-center rounded-full bg-brand text-xs font-bold text-white">
              1
            </span>
            <span>
              {t("installIOSStep1")}{" "}
              <svg
                className="inline align-[-3px] text-brand"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                aria-hidden="true"
              >
                <path d="M12 15V3m0 0L8 7m4-4 4 4" />
                <path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" />
              </svg>
            </span>
          </div>
          <div className="flex items-center gap-3 text-[13px]">
            <span className="grid h-[22px] w-[22px] flex-none place-items-center rounded-full bg-brand text-xs font-bold text-white">
              2
            </span>
            <span>{t("installIOSStep2")}</span>
          </div>
        </div>
      )}
    </div>
  );
}
