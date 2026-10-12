"use client";

import { useEffect, useState } from "react";
import { fetchCourierTracking, orderStatusWsProtocols, orderStatusWsUrl } from "../services/api";
import { mapCourierTracking } from "../lib/courier-tracking";
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
  receiptToken: string | undefined,
  enabled: boolean,
): CourierTracking | null {
  const [tracking, setTracking] = useState<CourierTracking | null>(null);

  useEffect(() => {
    if (!enabled || !orderId || !restaurantId || !receiptToken) {
      setTracking(null);
      return;
    }
    let cancelled = false;

    const refresh = () => {
      if (document.hidden) return;
      fetchCourierTracking(orderId, restaurantId, receiptToken)
        .then(value => { if (!cancelled) setTracking(value); })
        .catch(() => { /* Keep live position; an unavailable ETA is omitted by the API. */ });
    };
    refresh();
    const refreshTimer = setInterval(refresh, 60_000);

    const ws = new WebSocket(
      orderStatusWsUrl(orderId, restaurantId),
      orderStatusWsProtocols(receiptToken),
    );
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        if (data?.type !== "courier.location") return;
        const p = data.payload;
        if (p?.courier_lat == null || p?.courier_lng == null) return;
        const next = mapCourierTracking(p);
        if (next) setTracking(next);
      } catch {
        /* ignore malformed frames */
      }
    };

    return () => {
      cancelled = true;
      clearInterval(refreshTimer);
      try {
        ws.close();
      } catch {
        /* already closed */
      }
    };
  }, [orderId, restaurantId, receiptToken, enabled]);

  return tracking;
}
