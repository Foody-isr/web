"use client";

import { useEffect, useRef, useState } from "react";
import { OrderStatus } from "@/lib/types";
import { orderStatusWsUrl } from "@/services/api";

// Unified dine-in status flow for fallback when WebSocket is unavailable
const fallbackStatuses: OrderStatus[] = ["pending_review", "accepted", "in_kitchen", "ready", "received"];

export function useOrderStatus(orderId: string, restaurantId: string, initial?: OrderStatus) {
  const [status, setStatus] = useState<OrderStatus>(initial ?? "pending_review");
  const socketRef = useRef<WebSocket | null>(null);
  const fallbackTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const url = orderStatusWsUrl(orderId, restaurantId);
    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const payloadStatus = data.payload?.status || data.status;
      if (payloadStatus) setStatus(payloadStatus as OrderStatus);
    };

    ws.onerror = () => {
      // fallback: assume next status after a delay when WS is unavailable
      let idx = fallbackStatuses.indexOf(status);
      fallbackTimer.current = setInterval(() => {
        idx = Math.min(idx + 1, fallbackStatuses.length - 1);
        setStatus(fallbackStatuses[idx]);
        if (idx === fallbackStatuses.length - 1 && fallbackTimer.current) {
          clearInterval(fallbackTimer.current);
        }
      }, 60000);
    };

    return () => {
      ws.close();
      socketRef.current = null;
      if (fallbackTimer.current) clearInterval(fallbackTimer.current);
    };
  }, [orderId, restaurantId]);

  return status;
}
