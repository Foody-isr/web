"use client";

import Link from "next/link";
import { OrderStatusTimeline } from "@/components/OrderStatusTimeline";
import { useOrderStatus } from "@/hooks/useOrderStatus";
import { OrderResponse } from "@/lib/types";

type Props = {
  order: OrderResponse;
  orderId: string;
  restaurantId: string;
  tableId?: string;
  menuHref?: string;
  showWsHint?: boolean;
};

export function OrderTrackingClient({
  order,
  orderId,
  restaurantId,
  tableId,
  menuHref,
  showWsHint
}: Props) {
  const status = useOrderStatus(orderId, restaurantId, order.orderStatus);
  const paymentLabel = {
    paid: "Paid",
    unpaid: "Unpaid",
    pending: "Pending",
    refunded: "Refunded"
  }[order.paymentStatus] ?? "Unpaid";
  const paymentColor =
    order.paymentStatus === "paid" ? "text-green-600" : "text-orange-600";

  return (
    <main className="min-h-screen p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Order {orderId}</p>
          <h1 className="text-2xl font-semibold">Track your order</h1>
          <p className="text-sm text-slate-500">
            {tableId ? `Table ${tableId} · ` : ""}
            {order.currency} {order.total.toFixed(2)}
          </p>
        </div>
        {menuHref && (
          <Link
            href={menuHref}
            className="px-4 py-2 rounded-full border text-sm hover:border-brand"
          >
            Back to menu
          </Link>
        )}
      </header>
      <OrderStatusTimeline status={status} />
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <span className="font-semibold">Payment:</span>
        <span className={paymentColor}>{paymentLabel}</span>
      </div>
      {showWsHint && (
        <div className="card p-4 text-sm text-slate-600">
          WebSocket endpoint: <code>/ws?restaurant_id={restaurantId}&amp;order_id={orderId}</code>{" "}
          (requires auth). The UI listens for payloads like{" "}
          <code>{`{ "payload": { "status": "in_kitchen" } }`}</code>.
        </div>
      )}
    </main>
  );
}
