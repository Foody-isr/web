"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface Status {
  available: boolean;
  subscribed: boolean;
  subscribed_here: boolean;
  public_key?: string;
}

// A subscription belongs to this browser. Only its fingerprint is needed for a status check.
async function currentDevice(): Promise<string | undefined> {
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(subscription.endpoint),
  );
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/** Offers voluntary Web Push and lets the member withdraw for every device at this restaurant. */
export default function LoyaltyNotifications({
  restaurant,
  account,
  active,
}: {
  restaurant: number;
  account: number;
  active: boolean;
}) {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const life = useRef<AbortController | null>(null);
  const path =
    "/api/customer-api/me/loyalty-notifications?restaurant_id=" + restaurant;

  useEffect(() => {
    const controller = new AbortController();
    life.current = controller;
    const canPush =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(canPush);
    setBusy(false);
    setError(false);
    setStatus(null);
    async function load() {
      const headers = new Headers({
        "X-Foody-Loyalty-Account": String(account),
      });
      if (canPush) {
        const hash = await currentDevice();
        if (hash) headers.set("X-Foody-Push-Device", hash);
      }
      const result = await fetch(path, {
        headers,
        signal: controller.signal,
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
      });
      if (result.status === 404) return;
      if (!result.ok) throw Error();
      const value: Status = await result.json();
      if (!controller.signal.aborted) setStatus(value);
    }
    load().catch(() => {
      if (!controller.signal.aborted) setError(true);
    });
    return () => controller.abort();
  }, [path, account, attempt]);

  async function change(enabled: boolean) {
    const controller = life.current;
    if (busy || !controller || controller.signal.aborted || !status) return;
    setBusy(true);
    setError(false);
    try {
      let payload: Record<string, boolean | string> = { enabled };
      if (enabled) {
        if (!status.public_key || !supported) throw Error();
        // iOS requires this request to follow the member's tap directly.
        if ((await Notification.requestPermission()) !== "granted")
          throw Error();
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        const registration = await navigator.serviceWorker.ready;
        const key = Uint8Array.from(
          atob(status.public_key.replace(/-/g, "+").replace(/_/g, "/")),
          (c) => c.charCodeAt(0),
        );
        const sub =
          (await registration.pushManager.getSubscription()) ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: key,
          }));
        const info = sub.toJSON();
        if (!info.keys?.p256dh || !info.keys.auth) throw Error();
        payload = {
          enabled,
          endpoint: sub.endpoint,
          p256dh: info.keys.p256dh,
          auth: info.keys.auth,
        };
      }
      if (controller.signal.aborted) return;
      const result = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Foody-Loyalty-Account": String(account),
        },
        signal: controller.signal,
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        body: JSON.stringify(payload),
      });
      if (!result.ok) throw Error();
      const value: Status = await result.json();
      if (!controller.signal.aborted) setStatus(value);
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  if (!error && !(active && status?.available) && !status?.subscribed)
    return null;
  return (
    <section className="space-y-2 border-t border-[var(--divider)] py-5">
      <h2 className="font-semibold">{t("memberMessages")}</h2>
      <p className="text-sm">{t("memberMessageConsent")}</p>
      {error && (
        <p role="alert" className="text-sm">
          {t("memberMessageError")}
        </p>
      )}
      {!status ? (
        <button
          type="button"
          className="underline"
          onClick={() => setAttempt((n) => n + 1)}
        >
          {t("retry")}
        </button>
      ) : (
        <>
          {active && !supported && (
            <p className="text-sm">{t("memberMessageInstall")}</p>
          )}
          {status.subscribed_here && (
            <p role="status" className="text-sm">
              {t("memberMessagesHere")}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            {active &&
              supported &&
              status.available &&
              !status.subscribed_here && (
                <button
                  type="button"
                  className="rounded-lg border border-current px-4 py-2 text-sm font-semibold"
                  disabled={busy}
                  onClick={() => void change(true)}
                >
                  {t("memberMessagesOn")}
                </button>
              )}
            {status.subscribed && (
              <button
                type="button"
                className="underline text-sm"
                disabled={busy}
                onClick={() => void change(false)}
              >
                {t("memberMessagesOff")}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
