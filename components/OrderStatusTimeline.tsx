import { OrderStatus, OrderType } from "@/lib/types";
import clsx from "clsx";

type Step = { key: OrderStatus; label: string; description: string };

const dineInSteps: Step[] = [
  { key: "pending_review", label: "Pending", description: "Awaiting approval" },
  { key: "accepted", label: "Accepted", description: "Confirmed by staff" },
  { key: "in_kitchen", label: "In kitchen", description: "Cooking started" },
  { key: "ready", label: "Ready", description: "Ready to be served" },
  { key: "served", label: "Served", description: "Delivered to your table" },
];

const pickupSteps: Step[] = [
  { key: "pending_review", label: "Pending", description: "Awaiting approval" },
  { key: "accepted", label: "Accepted", description: "Confirmed by staff" },
  { key: "in_kitchen", label: "In kitchen", description: "Cooking started" },
  { key: "ready_for_pickup", label: "Ready", description: "Ready for pickup at counter" },
  { key: "picked_up", label: "Picked up", description: "Collected by customer" },
];

const deliverySteps: Step[] = [
  { key: "pending_review", label: "Pending", description: "Awaiting approval" },
  { key: "accepted", label: "Accepted", description: "Confirmed by staff" },
  { key: "in_kitchen", label: "In kitchen", description: "Cooking started" },
  { key: "ready_for_delivery", label: "Ready", description: "Ready for delivery" },
  { key: "out_for_delivery", label: "On the way", description: "Out for delivery" },
  { key: "delivered", label: "Delivered", description: "Delivered to you" },
];

function getStepsForOrderType(orderType?: OrderType): Step[] {
  switch (orderType) {
    case "pickup":
      return pickupSteps;
    case "delivery":
      return deliverySteps;
    case "dine_in":
    default:
      return dineInSteps;
  }
}

/**
 * Maps equivalent statuses so the timeline can highlight the correct step.
 * e.g. "ready" from the backend maps to "ready_for_pickup" in pickup steps.
 */
function resolveActiveIndex(steps: Step[], status: OrderStatus): number {
  // Direct match first
  const directIdx = steps.findIndex((s) => s.key === status);
  if (directIdx !== -1) return directIdx;

  // Fallback equivalences
  const equivalences: Record<string, OrderStatus[]> = {
    ready: ["ready_for_pickup", "ready_for_delivery"],
    ready_for_pickup: ["ready"],
    ready_for_delivery: ["ready"],
    served: ["picked_up", "delivered"],
    picked_up: ["served"],
    delivered: ["served"],
  };

  const alts = equivalences[status] ?? [];
  for (const alt of alts) {
    const idx = steps.findIndex((s) => s.key === alt);
    if (idx !== -1) return idx;
  }

  return -1;
}

type Props = {
  status: OrderStatus;
  orderType?: OrderType;
};

export function OrderStatusTimeline({ status, orderType }: Props) {
  const steps = getStepsForOrderType(orderType);
  const activeIndex = resolveActiveIndex(steps, status);
  const isCancelled = status === "cancelled" || status === "rejected";
  const isRefunded = status === "refunded";

  return (
    <div className="card p-4 space-y-4">
      {steps.map((step, idx) => {
        const done = idx <= activeIndex && activeIndex !== -1;
        const isTerminal = isCancelled || isRefunded;
        return (
          <div key={step.key} className="flex items-start gap-3">
            <div
              className={clsx(
                "w-10 h-10 rounded-button flex items-center justify-center border-2 font-bold",
                isTerminal
                  ? "border-accent-red text-accent-red"
                  : done
                  ? "bg-brand text-white border-brand"
                  : "border-light-divider text-ink-muted"
              )}
            >
              {isTerminal ? "!" : idx + 1}
            </div>
            <div className="flex-1">
              <p className="font-bold">
                {isCancelled ? "Cancelled" : isRefunded ? "Refunded" : step.label}
              </p>
              <p className="text-sm text-ink-muted">
                {isCancelled
                  ? "Order was cancelled"
                  : isRefunded
                  ? "Payment was refunded"
                  : step.description}
              </p>
              {idx < steps.length - 1 && (
                <div
                  className={clsx(
                    "h-8 w-px ml-5",
                    isTerminal ? "bg-accent-red/30" : done ? "bg-brand/60" : "bg-light-divider"
                  )}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
