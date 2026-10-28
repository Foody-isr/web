"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OrderResponse } from "@/lib/types";
import { isCurrentOrderEvent } from "@/lib/order-tracking";
import { fetchOrder, orderStatusWsProtocols, orderStatusWsUrl } from "@/services/api";

/** Refresh one coherent order snapshot after an event, reconnect or foreground resume. */
export function useOrderTracking(orderId: string, restaurantId: string, receiptToken: string | undefined, initial: OrderResponse) {
  const context = `${restaurantId}:${orderId}:${receiptToken ?? ""}`;
  const [snapshot, setSnapshot] = useState({ context, order: initial, failed: false, loading: false });
  const refreshRef = useRef<() => void>(() => undefined);
  const retry = useCallback(() => refreshRef.current(), []);

  useEffect(() => {
    let disposed = false;
    let pending: AbortController | undefined;
    let revision = 0;
    let advertised = initial.lifecycle != null && initial.lifecycle.kind !== "legacy";
    setSnapshot({ context, order: initial, failed: false, loading: false });
    const refresh = async () => {
      if (disposed || document.hidden) return;
      const request = ++revision;
      pending?.abort();
      pending = new AbortController();
      setSnapshot(previous => ({ ...previous, loading: true }));
      try {
        const next = await fetchOrder(orderId, restaurantId, receiptToken, pending.signal);
        if (disposed || request !== revision) return;
        if (next.lifecycle?.kind !== "legacy") advertised = true;
        const coherent = advertised && next.lifecycle?.kind === "legacy"
          ? { ...next, lifecycle: { kind: "unavailable" as const } } : next;
        setSnapshot({ context, order: coherent, failed: false, loading: false });
      } catch {
        if (disposed || request !== revision) return;
        // Keep the last known facts visible, but no financial affordance may
        // rely on them until a current authoritative refresh succeeds.
        setSnapshot(previous => ({ ...previous,
          order: advertised ? { ...previous.order, lifecycle: { kind: "unavailable" } } : previous.order,
          failed: true, loading: false,
        }));
      }
    };
    refreshRef.current = () => { void refresh(); };
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 30_000);
    const foreground = () => { if (!document.hidden) void refresh(); };
    window.addEventListener('focus', foreground);
    document.addEventListener('visibilitychange', foreground);

    let socket: WebSocket | undefined;
    if (orderId && restaurantId && receiptToken) {
      socket = new WebSocket(orderStatusWsUrl(orderId, restaurantId), orderStatusWsProtocols(receiptToken));
      socket.onopen = () => { void refresh(); };
      socket.onmessage = event => {
        try {
          if (isCurrentOrderEvent(JSON.parse(event.data), orderId, restaurantId)) void refresh();
        } catch {
          // Malformed frames are not evidence of payment or fulfillment.
        }
      };
      socket.onerror = () => { void refresh(); };
    }
    return () => {
      disposed = true;
      revision++;
      pending?.abort();
      clearInterval(timer);
      window.removeEventListener('focus', foreground);
      document.removeEventListener('visibilitychange', foreground);
      socket?.close();
      refreshRef.current = () => undefined;
    };
  }, [context, orderId, restaurantId, receiptToken, initial]);

  return snapshot.context === context
    ? { order: snapshot.order, refreshFailed: snapshot.failed, refreshing: snapshot.loading, retry }
    : { order: initial, refreshFailed: false, refreshing: false, retry };
}
