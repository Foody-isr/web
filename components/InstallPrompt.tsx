"use client";

import { useState, useEffect, useCallback } from "react";

type Props = {
  restaurantName: string;
  primaryColor?: string;
};

export function InstallPrompt({ restaurantName, primaryColor = "#EB5204" }: Props) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);

  const storageKey = `foody-install-dismissed`;

  useEffect(() => {
    // Don't show if already installed or previously dismissed
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (localStorage.getItem(storageKey)) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show after a brief delay
      setTimeout(() => setShowBanner(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [storageKey]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === "accepted") {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    localStorage.setItem(storageKey, "1");
  }, [storageKey]);

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto sm:w-auto sm:max-w-md z-[60] animate-slide-up">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0"
          style={{ backgroundColor: primaryColor }}
        >
          {restaurantName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            Add {restaurantName}
          </p>
          <p className="text-xs text-gray-500">
            Install for quick access
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleDismiss}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
          >
            Not now
          </button>
          <button
            onClick={handleInstall}
            className="text-xs font-semibold text-white px-4 py-2 rounded-lg"
            style={{ backgroundColor: primaryColor }}
          >
            Install
          </button>
        </div>
      </div>
    </div>
  );
}
