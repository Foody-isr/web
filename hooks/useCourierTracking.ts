"use client";

import { useEffect, useState } from "react";
import { fetchCourierTracking, orderStatusWsUrl } from "../services/api";
import type { CourierTracking } from "../lib/types";

/**
 * Live courier position for the customer. When `enabled` (the order is a
 * delivery that is out_for_delivery), it seeds from the public track endpoint
 * and then updates from `courier.location` events on the guest WebSocket.
 * Returns null until/unless a position is available. The socket only exists
 * while enabled, so it costs nothing outside the active delivery window.
 */
export function useCourierTracking(
  orderId: string,
  restaurantId: string,
  enabled: boolean,
): CourierTracking | null {
  const [tracking, setTracking] = useState<CourierTracking | null>(null);

  useEffect(() => {
    if (!enabled || !orderId || !restaurantId) {
      setTracking(null);
      return;
    }
    let cancelled = false;

    fetchCourierTracking(orderId, restaurantId)
      .then((t) => {
        if (!cancelled && t) setTracking(t);
      })
      .catch(() => {
        /* no initial position yet — the WS will deliver one */
      });

    const ws = new WebSocket(orderStatusWsUrl(orderId, restaurantId));
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        if (data?.type !== "courier.location") return;
        const p = data.payload;
        if (p?.courier_lat == null || p?.courier_lng == null) return;
        setTracking({
          courierFirstName: p.courier_first_name ?? undefined,
          courierLat: Number(p.courier_lat),
          courierLng: Number(p.courier_lng),
          destLat: p.dest_lat != null ? Number(p.dest_lat) : undefined,
          destLng: p.dest_lng != null ? Number(p.dest_lng) : undefined,
          etaSeconds: p.eta_seconds != null ? Number(p.eta_seconds) : undefined,
        });
      } catch {
        /* ignore malformed frames */
      }
    };

    return () => {
      cancelled = true;
      try {
        ws.close();
      } catch {
        /* already closed */
      }
    };
  }, [orderId, restaurantId, enabled]);

  return tracking;
}
