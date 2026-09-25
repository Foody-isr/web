"use client";

import { useEffect, useRef, useState } from "react";
import { OrderStatus } from "@/lib/types";
import { orderStatusWsProtocols, orderStatusWsUrl } from "@/services/api";

export function useOrderStatus(orderId: string, restaurantId: string, receiptToken?: string, initial?: OrderStatus) {
  const [status, setStatus] = useState<OrderStatus>(initial ?? "pending_review");
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!orderId || !restaurantId || !receiptToken) return;
    const url = orderStatusWsUrl(orderId, restaurantId);
    const ws = new WebSocket(url, orderStatusWsProtocols(receiptToken));
    socketRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const payloadStatus = data.payload?.status || data.status;
      if (payloadStatus) setStatus(payloadStatus as OrderStatus);
    };

    // Never synthesize order progress when the socket fails. The last status
    // received from the server is safer than telling a guest an order is ready
    // when it is not.
    ws.onerror = () => undefined;

    return () => {
      ws.close();
      socketRef.current = null;
    };
  }, [orderId, restaurantId, receiptToken]);

  return status;
}
