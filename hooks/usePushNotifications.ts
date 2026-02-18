"use client";

import { useEffect, useRef, useState } from "react";
import {
  getVAPIDPublicKey,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/services/api";

type PushState = "idle" | "subscribing" | "subscribed" | "denied" | "unsupported";

/**
 * Hook to manage Web Push notification subscription for an order.
 * Automatically registers a service worker and subscribes to push notifications.
 *
 * @param orderId - The order to subscribe push notifications for
 * @param restaurantId - The restaurant the order belongs to
 * @param autoSubscribe - If true, automatically subscribes after permission is granted
 */
export function usePushNotifications(
  orderId: string,
  restaurantId: string,
  autoSubscribe = true
) {
  const [state, setState] = useState<PushState>("idle");
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<PushSubscription | null>(null);

  useEffect(() => {
    // Check browser support
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }

    // Check if permission was already denied
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }

    // Register service worker
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // Check if already subscribed
        return registration.pushManager.getSubscription().then((existing) => {
          if (existing) {
            subscriptionRef.current = existing;
            // Re-register on server side (in case it was lost)
            sendSubscriptionToServer(existing);
            setState("subscribed");
            return;
          }

          if (autoSubscribe && Notification.permission === "granted") {
            doSubscribe(registration);
          }
        });
      })
      .catch((err) => {
        console.error("[push] service worker registration failed:", err);
        setError("Failed to register service worker");
      });
  }, [orderId, restaurantId]);

  async function doSubscribe(registration?: ServiceWorkerRegistration) {
    setState("subscribing");
    setError(null);

    try {
      const reg =
        registration || (await navigator.serviceWorker.getRegistration());
      if (!reg) {
        setError("No service worker registration");
        setState("idle");
        return;
      }

      // Fetch VAPID public key from server
      const vapidKey = await getVAPIDPublicKey();
      if (!vapidKey) {
        setError("Push notifications not configured on server");
        setState("idle");
        return;
      }

      // Request permission if not already granted
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }

      // Subscribe to push
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });

      subscriptionRef.current = subscription;

      // Send subscription to our server
      await sendSubscriptionToServer(subscription);

      setState("subscribed");
    } catch (err: any) {
      console.error("[push] subscription failed:", err);
      setError(err.message || "Failed to subscribe");
      setState("idle");
    }
  }

  async function sendSubscriptionToServer(subscription: PushSubscription) {
    const subJSON = subscription.toJSON();
    try {
      await subscribeToPush({
        order_id: Number(orderId),
        restaurant_id: Number(restaurantId),
        endpoint: subJSON.endpoint!,
        p256dh: subJSON.keys!.p256dh!,
        auth: subJSON.keys!.auth!,
      });
    } catch (err) {
      console.error("[push] failed to register subscription on server:", err);
    }
  }

  async function unsubscribe() {
    if (subscriptionRef.current) {
      const endpoint = subscriptionRef.current.endpoint;
      await subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
      setState("idle");

      try {
        await unsubscribeFromPush({
          order_id: Number(orderId),
          endpoint,
        });
      } catch (err) {
        console.error("[push] failed to unsubscribe on server:", err);
      }
    }
  }

  function requestPermissionAndSubscribe() {
    doSubscribe();
  }

  return {
    state,
    error,
    subscribe: requestPermissionAndSubscribe,
    unsubscribe,
    isSupported: state !== "unsupported",
    isSubscribed: state === "subscribed",
  };
}

/**
 * Convert a base64 URL-encoded string to a Uint8Array
 * (required for applicationServerKey)
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
