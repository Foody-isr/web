"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useI18n } from "@/lib/i18n";

type Props = {
  open: boolean;
  onClose: () => void;
  ssid: string;
  password?: string;
};

/**
 * Customer-facing WiFi credential sheet. Opens when the hero "📶 WiFi · X"
 * pill is tapped.
 *
 *   ┌────────────────────────────────────┐
 *   │                                  ✕ │
 *   │           📶                       │
 *   │      Se connecter au WiFi          │
 *   │  Pointez votre appareil photo      │
 *   │                                    │
 *   │       ┌─────────────────┐          │
 *   │       │   QR (190×190)  │          │
 *   │       └─────────────────┘          │
 *   │                                    │
 *   │  Réseau                            │
 *   │  BellaItalia-Guest                 │
 *   │                                    │
 *   │  Mot de passe                      │
 *   │  ••••••••                [ Copier ]│
 *   └────────────────────────────────────┘
 *
 * The QR is encoded in the standard `WIFI:T:WPA;S:<SSID>;P:<password>;;`
 * format that both iOS and Android Camera apps recognise — point and join.
 */
export function WifiSheet({ open, onClose, ssid, password }: Props) {
  const { t, direction } = useI18n();
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reset masked password each time the sheet opens.
  useEffect(() => {
    if (open) {
      setRevealed(false);
      setCopied(false);
    }
  }, [open]);

  // Body scroll lock while the sheet is open.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // ESC dismisses.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // WPA is the only sensible default for restaurant WiFi. If a restaurant
  // runs an open network we still emit a valid WIFI: URI by leaving the
  // password empty — most scanners handle that gracefully.
  const escape = (s: string) =>
    s.replace(/([\\;,":])/g, "\\$1");
  const wifiUri = password
    ? `WIFI:T:WPA;S:${escape(ssid)};P:${escape(password)};;`
    : `WIFI:T:nopass;S:${escape(ssid)};P:;;`;

  const handleCopy = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard might be unavailable (non-HTTPS, older browser) — no-op.
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/55 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* Sheet */}
          <motion.div
            initial={{ y: "100%", opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed bottom-0 inset-x-0 z-[121] bg-[var(--surface)] rounded-t-3xl shadow-2xl flex flex-col sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-full sm:max-w-md sm:bottom-4 sm:rounded-3xl"
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 0px))" }}
            dir={direction}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-[var(--divider)]" />
            </div>

            {/* Close button (top-right) */}
            <button
              onClick={onClose}
              aria-label={t("close") || "Close"}
              className="absolute top-4 end-4 w-9 h-9 rounded-full bg-[var(--surface-subtle)] flex items-center justify-center text-[var(--text-primary)] hover:bg-[var(--divider)] active:scale-[0.96] transition"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="px-6 pt-4 pb-2 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand/12 mb-2.5">
                <span className="text-2xl leading-none">📶</span>
              </div>
              <h2 className="text-[22px] font-extrabold tracking-tight text-[var(--text-primary)]">
                {t("wifiSheetTitle") || "Connect to WiFi"}
              </h2>
              <p className="text-[12.5px] text-[var(--text-soft)] mt-1">
                {t("wifiSheetHint") || "Point your camera at the QR code"}
              </p>
            </div>

            {/* QR card */}
            <div className="px-6 pb-4 flex justify-center">
              <div
                className="rounded-2xl p-3 bg-white"
                style={{ boxShadow: "0 8px 24px -8px rgba(0,0,0,0.15)" }}
              >
                <QRCodeSVG
                  value={wifiUri}
                  size={190}
                  level="M"
                  // Always render the QR on white so the encoding is reliable —
                  // some dark-mode renderings of the surface tint can confuse
                  // scanners.
                  bgColor="#FFFFFF"
                  fgColor="#0F1A0C"
                />
              </div>
            </div>

            {/* Credentials */}
            <div className="px-6 pb-6 space-y-3">
              <CredentialRow label={t("wifiNetwork") || "Network"} value={ssid} mono />
              {password && (
                <CredentialRow
                  label={t("wifiPassword") || "Password"}
                  value={revealed ? password : "••••••••••"}
                  mono
                  trailing={
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setRevealed((r) => !r)}
                        className="text-[11px] font-bold text-brand hover:underline"
                      >
                        {revealed
                          ? t("hide") || "Hide"
                          : t("reveal") || "Reveal"}
                      </button>
                      <button
                        onClick={handleCopy}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand text-white text-[11px] font-extrabold active:scale-[0.96] transition"
                      >
                        {copied ? (
                          <>
                            ✓ {t("copied") || "Copied"}
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                              <rect x="9" y="9" width="11" height="11" rx="2" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15V5a2 2 0 0 1 2-2h10" />
                            </svg>
                            {t("copy") || "Copy"}
                          </>
                        )}
                      </button>
                    </div>
                  }
                />
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ─────────────────────────── Credential Row ───────────────────────────── */

function CredentialRow({
  label,
  value,
  mono,
  trailing,
}: {
  label: string;
  value: string;
  mono?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-[var(--surface-subtle)]">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-soft)]">
          {label}
        </p>
        <p
          className={`text-[14.5px] font-bold text-[var(--text-primary)] mt-0.5 truncate ${
            mono ? "font-mono" : ""
          }`}
        >
          {value}
        </p>
      </div>
      {trailing}
    </div>
  );
}
