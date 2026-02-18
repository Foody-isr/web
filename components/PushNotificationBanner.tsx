"use client";

import { usePushNotifications } from "@/hooks/usePushNotifications";

type Props = {
  orderId: string;
  restaurantId: string;
};

/**
 * Reusable push notification opt-in banner.
 * Shows a button to subscribe, a confirmation when subscribed,
 * or a hint when notifications are blocked.
 */
export function PushNotificationBanner({ orderId, restaurantId }: Props) {
  const push = usePushNotifications(orderId, restaurantId);

  if (!push.isSupported) return null;

  if (push.isSubscribed) {
    return (
      <div className="p-3 flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400 rounded-xl">
        <span>✅</span>
        <span>Notifications enabled — we&apos;ll ping you when your order is ready!</span>
      </div>
    );
  }

  if (push.state === "denied") {
    return (
      <div className="p-3 flex items-center gap-2 text-sm text-ink-muted rounded-xl">
        <span>🔕</span>
        <span>Notifications blocked — enable them in your browser settings to get notified.</span>
      </div>
    );
  }

  return (
    <button
      onClick={push.subscribe}
      className="w-full p-3 flex items-center gap-3 hover:shadow-lg transition border border-brand/30 bg-brand/5 rounded-xl"
    >
      <span className="text-2xl">🔔</span>
      <div className="text-left flex-1">
        <p className="font-semibold text-sm">Get notified when your order is ready</p>
        <p className="text-xs text-ink-muted">
          {push.state === "subscribing" ? "Setting up..." : "Tap to enable push notifications"}
        </p>
      </div>
    </button>
  );
}
