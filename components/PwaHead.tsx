import Script from "next/script";

type Props = {
  /** Restaurant slug used to resolve the per-restaurant manifest & favicon. */
  slug: string;
  /** Brand colour applied to the browser theme-color / status bar. */
  primaryColor?: string;
  /** App title shown when installed to the iOS home screen. */
  title?: string;
  /** Optional apple-touch-icon for the iOS home-screen icon. */
  logoUrl?: string;
};

/**
 * PwaHead injects everything a page needs to be installable as the restaurant's
 * PWA: the per-restaurant manifest link, theme colour, Apple home-screen meta
 * tags, and the service-worker registration.
 *
 * It MUST be present on every page where we want the browser to offer install
 * (Chrome only fires `beforeinstallprompt` on pages that link a valid manifest).
 * That includes the `/r/*` menu pages AND the order confirmation page, which
 * lives in a different route tree — hence this shared component instead of
 * inlining the tags in a single layout.
 *
 * It also captures `beforeinstallprompt` into a window global the moment it
 * fires, so the InstallPrompt component can pick it up even if the event fired
 * before React mounted (a common cause of "the button never shows").
 */
export function PwaHead({ slug, primaryColor = "#EB5204", title = "Foody", logoUrl }: Props) {
  return (
    <>
      <link rel="manifest" href={`/api/manifest/${slug}`} />
      <link rel="icon" href={`/api/favicon/${slug}`} />
      <meta name="theme-color" content={primaryColor} />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="apple-mobile-web-app-title" content={title} />
      {logoUrl && <link rel="apple-touch-icon" href={logoUrl} />}
      <Script id="pwa-a2hs-capture" strategy="beforeInteractive">
        {`window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__foodyDeferredInstall=e;});`}
      </Script>
      <Script id="sw-register" strategy="afterInteractive">
        {`if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(function(){})}`}
      </Script>
    </>
  );
}
