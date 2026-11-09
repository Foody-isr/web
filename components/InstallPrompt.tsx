"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpTrayIcon, PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { localizedCopy, useI18n } from "@/lib/i18n";
import { mobileText, type InstallPlacement, type MobileExperience, type MobilePreview } from "@/lib/mobileExperience";
import { loyaltyCheckoutEnabled } from "@/lib/loyalty-checkout";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    __foodyDeferredInstall?: BeforeInstallPromptEvent;
    __foodyDeferredInstallManifest?: string | null;
  }
}

type Props = {
  restaurantId: string;
  restaurantName?: string;
  restaurantSlug?: string;
  logoUrl?: string;
  installation?: MobileExperience["installation"];
  placement?: InstallPlacement;
  preview?: MobilePreview;
  loyaltyMode?: "points" | "visits";
  loyaltyHref?: string;
};

type Platform = "safari" | "ios-chrome" | "android" | "embedded" | "other";

/** Reads the browser's app display mode, including older iOS web apps. */
export function isStandaloneApp(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function installationPlatform(): Platform {
  const userAgent = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /android/i.test(userAgent);
  if (!ios && !android) return "other";
  if (/Instagram|FBAN|FBAV|FB_IAB|WhatsApp|TikTok|; wv\)/i.test(userAgent)) return "embedded";
  if (android) return "android";
  if (/CriOS/i.test(userAgent)) return "ios-chrome";
  return /Safari/i.test(userAgent) && !/FxiOS|EdgiOS/i.test(userAgent) ? "safari" : "embedded";
}

function dismissedKey(restaurantId: string, placement: InstallPlacement): string {
  return "foody.a2hs.dismissed." + restaurantId + (placement === "confirmation" ? "" : "." + placement);
}

/** Offers the native prompt where available and browser-specific instructions elsewhere. */
export function InstallPrompt({
  restaurantId,
  restaurantName = "",
  restaurantSlug,
  logoUrl,
  installation,
  placement = "confirmation",
  preview,
  loyaltyMode,
  loyaltyHref,
}: Props) {
  const i18n = useI18n();
  const locale = preview?.locale ?? i18n.locale;
  const t = preview ? (key: string) => localizedCopy(locale, key) : i18n.t;
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [native, setNative] = useState<BeforeInstallPromptEvent>();
  const [hidden, setHidden] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [manualLink, setManualLink] = useState("");
  const [showVideo, setShowVideo] = useState(false);
  const key = dismissedKey(restaurantId, placement);
  const manifest = "/api/manifest/" + (restaurantSlug || restaurantId);

  useEffect(() => {
    if (preview) return;
    setPlatform(installationPlatform());
    setHidden(isStandaloneApp() || (placement !== "menu" && readDismissed(key)));
    setNative(window.__foodyDeferredInstallManifest === manifest ? window.__foodyDeferredInstall : undefined);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      if (document.querySelector('link[rel="manifest"]')?.getAttribute("href") === manifest) {
        window.__foodyDeferredInstall = event as BeforeInstallPromptEvent;
        window.__foodyDeferredInstallManifest = manifest;
        setNative(window.__foodyDeferredInstall);
      }
    };
    const onInstalled = () => {
      delete window.__foodyDeferredInstall;
      setHidden(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [key, manifest, placement, preview]);

  if (
    installation?.[placement] === false ||
    preview?.mode === "standalone" ||
    (!preview && (hidden || platform === null || (platform === "other" && !native)))
  ) return null;

  const overridden = installation?.placement_copy?.[placement];
  const shared = installation?.copy;
  const title = mobileText(overridden?.title, locale,
    mobileText(shared?.title, locale, t(restaurantName ? "mobileInstallTitle" : "mobileInstallGeneric"), restaurantName),
    restaurantName);
  const subtitle = mobileText(overridden?.subtitle, locale,
    mobileText(shared?.subtitle, locale, t("mobileInstallSubtitle"), restaurantName), restaurantName);
  const loyaltyBenefit = installation?.benefit === "loyalty" && loyaltyMode && (preview || loyaltyCheckoutEnabled)
    ? t(loyaltyMode === "points" ? "mobileInstallPoints" : "mobileInstallVisits")
    : undefined;
  const action = mobileText(overridden?.action, locale,
    mobileText(shared?.action, locale, t("mobileInstallAction"), restaurantName), restaurantName);
  const guidePlatform = preview ? "safari" : platform;
  const ios = guidePlatform === "safari" || guidePlatform === "ios-chrome";

  const dismiss = () => {
    if (preview) return;
    setHidden(true);
    try {
      localStorage.setItem(key, "1");
    } catch {
      // A session-only dismissal still works when storage is unavailable.
    }
  };

  const install = async () => {
    const available = window.__foodyDeferredInstallManifest === manifest ? window.__foodyDeferredInstall : undefined;
    setExpanded(true);
    if (!available) {
      setNative(undefined);
      return;
    }
    delete window.__foodyDeferredInstall;
    setNative(undefined);
    try {
      await available.prompt();
      if ((await available.userChoice).outcome === "accepted") setHidden(true);
    } catch {
      // Keep the manual browser instructions available after a prompt failure.
    }
  };

  const copyLink = async () => {
    const path = "/r/" + encodeURIComponent(restaurantSlug || restaurantId);
    const url = new URL(path, window.location.origin);
    url.searchParams.set("lang", locale);
    try {
      await navigator.clipboard.writeText(url.href);
      setCopied(true);
    } catch {
      setManualLink(url.href);
    }
  };

  return (
    <section className="mobile-install-card" data-placement={placement} dir={locale === "he" ? "rtl" : "ltr"}>
      {placement !== "menu" && !preview && (
        <button type="button" className="mobile-install-dismiss" onClick={dismiss} aria-label={t("installDismiss")}>
          <XMarkIcon width={16} height={16} />
        </button>
      )}
      <div className="mobile-install-heading">
        <span className="mobile-install-icon" aria-hidden="true">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" />
          ) : restaurantName.trim().charAt(0).toUpperCase() || <PlusIcon width={20} />}
        </span>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      {loyaltyBenefit && loyaltyBenefit !== subtitle && <p className="mobile-install-benefit">{loyaltyBenefit}</p>}
      {loyaltyHref && <Link className="mobile-install-loyalty" href={loyaltyHref} prefetch={false}
        onClick={preview ? event => event.preventDefault() : undefined}>{t("mobileNavLoyalty")}</Link>}
      {native && !preview ? (
        <button type="button" className="mobile-install-action" onClick={() => void install()}>{action}</button>
      ) : (
        <>
          <button type="button" className="mobile-install-action" aria-expanded={expanded} onClick={() => {
            setExpanded(!expanded);
            setShowVideo(false);
          }}>
            {expanded ? t("mobileInstallClose") : action}
          </button>
          {expanded && (ios ? (
            <>
              <ol className="mobile-install-steps" role="list">
                <li>
                  <div>
                    <strong>{t(guidePlatform === "safari" ? "mobileInstallSafari" : "mobileInstallChrome")}</strong>
                    {guidePlatform === "safari" && <span>{t("mobileInstallSafariHint")}</span>}
                  </div>
                  <span className="mobile-install-system-symbol" aria-hidden="true"><ArrowUpTrayIcon width={17} /></span>
                </li>
                <li>
                  <div>
                    <strong>{t("mobileInstallIOSChoose")}</strong>
                    <span>{t("mobileInstallIOSChooseHint")}</span>
                  </div>
                  <span className="mobile-install-system-symbol" aria-hidden="true"><PlusIcon width={17} /></span>
                </li>
                <li>
                  <div>
                    <strong>{t("mobileInstallIOSAdd")}</strong>
                    <span>{t("mobileInstallIOSAdded")}</span>
                    <span>{t("mobileInstallWebApp")}</span>
                  </div>
                  <span className="mobile-install-system-symbol" aria-hidden="true">{t("mobileInstallIOSAddLabel")}</span>
                </li>
              </ol>
              {guidePlatform === "safari" && (
                <details className="mobile-install-help">
                  <summary>{t("mobileInstallMissing")}</summary>
                  <p>{t("mobileInstallEditActions")}</p>
                </details>
              )}
              {guidePlatform === "safari" && !preview && placement === "confirmation" && (
                <details className="mobile-install-help" onToggle={event => setShowVideo(event.currentTarget.open)}>
                  <summary>{t("installWatchVideo")}</summary>
                  {showVideo && <video src="/install-ios.mp4" poster="/install-ios-poster.jpg" muted playsInline controls />}
                </details>
              )}
            </>
          ) : (
            <div className="mobile-install-help">
              <p>{t(guidePlatform === "embedded" ? "mobileInstallExternal" : "mobileInstallAndroid")}</p>
              {guidePlatform === "embedded" && (
                <>
                  <button type="button" onClick={() => void copyLink()}>{t("mobileInstallCopy")}</button>
                  {copied && <span role="status">{t("mobileInstallCopied")}</span>}
                  {manualLink && <input aria-label={t("mobileInstallCopy")} readOnly value={manualLink} onFocus={event => event.currentTarget.select()} />}
                </>
              )}
            </div>
          ))}
        </>
      )}
    </section>
  );
}

function readDismissed(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
