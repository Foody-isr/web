import { OrderStatus, OrderType, PaymentStatus } from "@/lib/types";
import clsx from "clsx";

type Step = { key: string; label: string; description: string };

/** Dine-in flow for table service when staff approval is required */
const dineInSteps: Step[] = [
  { key: "accepted", label: "Accepted", description: "Confirmed by staff" },
  { key: "in_kitchen", label: "In kitchen", description: "Cooking started" },
  { key: "ready", label: "Ready", description: "Ready to be served" },
  { key: "served", label: "Served", description: "Delivered to your table" },
  { key: "payment", label: "Pay", description: "Complete your payment" },
];

/** Dine-in flow for counter service when staff approval is required */
const dineInCounterSteps: Step[] = [
  { key: "accepted", label: "Accepted", description: "Confirmed by staff" },
  { key: "in_kitchen", label: "In kitchen", description: "Cooking started" },
  { key: "ready", label: "Ready", description: "Pick up at counter" },
  { key: "served", label: "Picked up", description: "Collected" },
  { key: "payment", label: "Pay", description: "Complete your payment" },
];

/** Dine-in flow for table service when auto-send to kitchen is enabled */
const dineInAutoSteps: Step[] = [
  { key: "in_kitchen", label: "In kitchen", description: "Your order is being prepared" },
  { key: "ready", label: "Ready", description: "Ready to be served" },
  { key: "served", label: "Served", description: "Delivered to your table" },
  { key: "payment", label: "Pay", description: "Complete your payment" },
];

/** Dine-in flow for counter service when auto-send to kitchen is enabled */
const dineInCounterAutoSteps: Step[] = [
  { key: "in_kitchen", label: "In kitchen", description: "Your order is being prepared" },
  { key: "ready", label: "Ready", description: "Pick up at counter" },
  { key: "served", label: "Picked up", description: "Collected" },
  { key: "payment", label: "Pay", description: "Complete your payment" },
];

const pickupSteps: Step[] = [
  { key: "pending_review", label: "Pending", description: "Awaiting approval" },
  { key: "accepted", label: "Accepted", description: "Confirmed by staff" },
  { key: "in_kitchen", label: "In kitchen", description: "Cooking started" },
  { key: "ready", label: "Ready", description: "Ready for pickup at counter" },
  { key: "served", label: "Picked up", description: "Collected by customer" },
];

const deliverySteps: Step[] = [
  { key: "pending_review", label: "Pending", description: "Awaiting approval" },
  { key: "accepted", label: "Accepted", description: "Confirmed by staff" },
  { key: "in_kitchen", label: "In kitchen", description: "Cooking started" },
  { key: "ready_for_delivery", label: "Ready", description: "Ready for delivery" },
  { key: "out_for_delivery", label: "On the way", description: "Out for delivery" },
  { key: "delivered", label: "Delivered", description: "Delivered to you" },
];

/** Scheduled pickup flow (batch fulfillment) */
const scheduledPickupSteps: Step[] = [
  { key: "scheduled", label: "Scheduled", description: "Order placed for batch fulfillment" },
  { key: "pending_review", label: "Pending", description: "Awaiting approval" },
  { key: "accepted", label: "Accepted", description: "Confirmed by staff" },
  { key: "in_kitchen", label: "In kitchen", description: "Cooking started" },
  { key: "ready", label: "Ready", description: "Ready for pickup at counter" },
  { key: "served", label: "Picked up", description: "Collected by customer" },
];

/** Scheduled delivery flow (batch fulfillment) */
const scheduledDeliverySteps: Step[] = [
  { key: "scheduled", label: "Scheduled", description: "Order placed for batch fulfillment" },
  { key: "pending_review", label: "Pending", description: "Awaiting approval" },
  { key: "accepted", label: "Accepted", description: "Confirmed by staff" },
  { key: "in_kitchen", label: "In kitchen", description: "Cooking started" },
  { key: "ready_for_delivery", label: "Ready", description: "Ready for delivery" },
  { key: "out_for_delivery", label: "On the way", description: "Out for delivery" },
  { key: "delivered", label: "Delivered", description: "Delivered to you" },
];

/**
 * Returns the appropriate timeline steps based on order type, service mode,
 * and current status. When the order was auto-sent to kitchen (status is
 * already in_kitchen or later), the shorter auto-kitchen timeline is used
 * so customers don't see irrelevant "Pending" / "Accepted" steps.
 */
function getStepsForOrderType(
  orderType?: OrderType,
  serviceMode?: string,
  status?: OrderStatus
): Step[] {
  // Scheduled (batch fulfillment) orders get the extended timeline with
  // the "Scheduled" step at the front. Once the order is promoted past
  // scheduled status, the regular timeline kicks in.
  const isScheduledFlow = status === "scheduled";

  switch (orderType) {
    case "pickup":
      return isScheduledFlow ? scheduledPickupSteps : pickupSteps;
    case "delivery":
      return isScheduledFlow ? scheduledDeliverySteps : deliverySteps;
    case "dine_in": {
      // If the order skipped pending_review/accepted (auto-sent to kitchen),
      // use the shorter timeline without approval steps.
      const isAutoKitchen =
        status !== undefined &&
        status !== "pending_review" &&
        status !== "accepted";
      if (serviceMode === "counter") {
        return isAutoKitchen ? dineInCounterAutoSteps : dineInCounterSteps;
      }
      return isAutoKitchen ? dineInAutoSteps : dineInSteps;
    }
    default:
      return dineInSteps;
  }
}

/**
 * Maps equivalent statuses so the timeline can highlight the correct step.
 * e.g. "ready" from the backend maps to "ready_for_pickup" in pickup steps.
 */
function resolveActiveIndex(
  steps: Step[],
  status: OrderStatus,
  paymentStatus?: PaymentStatus
): number {
  // For dine-in timelines with a payment step, check if payment is done
  const hasPaymentStep = steps.some((s) => s.key === "payment");
  if (hasPaymentStep && paymentStatus === "paid") {
    return steps.findIndex((s) => s.key === "payment");
  }

  // Direct match first
  const directIdx = steps.findIndex((s) => s.key === status);
  if (directIdx !== -1) return directIdx;

  // Fallback equivalences for backward compatibility
  const equivalences: Record<string, OrderStatus[]> = {
    ready: ["ready_for_delivery"],
    ready_for_delivery: ["ready"],
    received: ["served", "delivered"],
    served: ["received", "delivered"],
    delivered: ["served", "received"],
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
  serviceMode?: string;
  paymentStatus?: PaymentStatus;
};

export function OrderStatusTimeline({ status, orderType, serviceMode, paymentStatus }: Props) {
  const steps = getStepsForOrderType(orderType, serviceMode, status);
  const activeIndex = resolveActiveIndex(steps, status, paymentStatus);
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
                  : step.key === "payment" && paymentStatus === "paid"
                  ? "Payment complete"
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
