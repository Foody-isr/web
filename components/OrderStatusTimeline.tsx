"use client";

import { OrderStatus, OrderType, PaymentStatus } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import clsx from "clsx";

type Step = { key: string; labelKey: string; descKey: string };

/** Dine-in flow for table service when staff approval is required */
const dineInSteps: Step[] = [
  { key: "accepted", labelKey: "statusAccepted", descKey: "descConfirmedByStaff" },
  { key: "in_kitchen", labelKey: "statusInKitchen", descKey: "descCookingStarted" },
  { key: "ready", labelKey: "statusReady", descKey: "descReadyToBeServed" },
  { key: "served", labelKey: "statusServed", descKey: "descDeliveredToTable" },
  { key: "payment", labelKey: "statusPay", descKey: "descCompletePayment" },
];

/** Dine-in flow for counter service when staff approval is required */
const dineInCounterSteps: Step[] = [
  { key: "accepted", labelKey: "statusAccepted", descKey: "descConfirmedByStaff" },
  { key: "in_kitchen", labelKey: "statusInKitchen", descKey: "descCookingStarted" },
  { key: "ready", labelKey: "statusReady", descKey: "descPickUpAtCounter" },
  { key: "served", labelKey: "statusPickedUp", descKey: "descCollected" },
  { key: "payment", labelKey: "statusPay", descKey: "descCompletePayment" },
];

/** Dine-in flow for table service when auto-send to kitchen is enabled */
const dineInAutoSteps: Step[] = [
  { key: "in_kitchen", labelKey: "statusInKitchen", descKey: "descOrderBeingPrepared" },
  { key: "ready", labelKey: "statusReady", descKey: "descReadyToBeServed" },
  { key: "served", labelKey: "statusServed", descKey: "descDeliveredToTable" },
  { key: "payment", labelKey: "statusPay", descKey: "descCompletePayment" },
];

/** Dine-in flow for counter service when auto-send to kitchen is enabled */
const dineInCounterAutoSteps: Step[] = [
  { key: "in_kitchen", labelKey: "statusInKitchen", descKey: "descOrderBeingPrepared" },
  { key: "ready", labelKey: "statusReady", descKey: "descPickUpAtCounter" },
  { key: "served", labelKey: "statusPickedUp", descKey: "descCollected" },
  { key: "payment", labelKey: "statusPay", descKey: "descCompletePayment" },
];

const pickupSteps: Step[] = [
  { key: "pending_review", labelKey: "statusPending", descKey: "descAwaitingApproval" },
  { key: "accepted", labelKey: "statusAccepted", descKey: "descConfirmedByStaff" },
  { key: "in_kitchen", labelKey: "statusInKitchen", descKey: "descCookingStarted" },
  { key: "ready", labelKey: "statusReady", descKey: "descReadyForPickup" },
  { key: "served", labelKey: "statusPickedUp", descKey: "descCollectedByCustomer" },
];

const deliverySteps: Step[] = [
  { key: "pending_review", labelKey: "statusPending", descKey: "descAwaitingApproval" },
  { key: "accepted", labelKey: "statusAccepted", descKey: "descConfirmedByStaff" },
  { key: "in_kitchen", labelKey: "statusInKitchen", descKey: "descCookingStarted" },
  { key: "ready_for_delivery", labelKey: "statusReadyForDelivery", descKey: "descReadyForDelivery" },
  { key: "out_for_delivery", labelKey: "statusOnTheWay", descKey: "descOutForDelivery" },
  { key: "delivered", labelKey: "statusDelivered", descKey: "descDeliveredToYou" },
];

/** Scheduled pickup flow (batch fulfillment) */
const scheduledPickupSteps: Step[] = [
  { key: "scheduled", labelKey: "statusScheduled", descKey: "descScheduledOrder" },
  { key: "pending_review", labelKey: "statusPending", descKey: "descAwaitingApproval" },
  { key: "accepted", labelKey: "statusAccepted", descKey: "descConfirmedByStaff" },
  { key: "in_kitchen", labelKey: "statusInKitchen", descKey: "descCookingStarted" },
  { key: "ready", labelKey: "statusReady", descKey: "descReadyForPickup" },
  { key: "served", labelKey: "statusPickedUp", descKey: "descCollectedByCustomer" },
];

/** Scheduled delivery flow (batch fulfillment) */
const scheduledDeliverySteps: Step[] = [
  { key: "scheduled", labelKey: "statusScheduled", descKey: "descScheduledOrder" },
  { key: "pending_review", labelKey: "statusPending", descKey: "descAwaitingApproval" },
  { key: "accepted", labelKey: "statusAccepted", descKey: "descConfirmedByStaff" },
  { key: "in_kitchen", labelKey: "statusInKitchen", descKey: "descCookingStarted" },
  { key: "ready_for_delivery", labelKey: "statusReadyForDelivery", descKey: "descReadyForDelivery" },
  { key: "out_for_delivery", labelKey: "statusOnTheWay", descKey: "descOutForDelivery" },
  { key: "delivered", labelKey: "statusDelivered", descKey: "descDeliveredToYou" },
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
  const isScheduledFlow = status === "scheduled";

  switch (orderType) {
    case "pickup":
      return isScheduledFlow ? scheduledPickupSteps : pickupSteps;
    case "delivery":
      return isScheduledFlow ? scheduledDeliverySteps : deliverySteps;
    case "dine_in": {
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
 */
function resolveActiveIndex(
  steps: Step[],
  status: OrderStatus,
  paymentStatus?: PaymentStatus
): number {
  const hasPaymentStep = steps.some((s) => s.key === "payment");
  if (hasPaymentStep && paymentStatus === "paid") {
    return steps.findIndex((s) => s.key === "payment");
  }

  const directIdx = steps.findIndex((s) => s.key === status);
  if (directIdx !== -1) return directIdx;

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
  const { t } = useI18n();
  const steps = getStepsForOrderType(orderType, serviceMode, status);
  const activeIndex = resolveActiveIndex(steps, status, paymentStatus);
  const isCancelled = status === "cancelled" || status === "rejected";
  const isRefunded = status === "refunded";

  return (
    <div className="card p-5 space-y-0">
      {steps.map((step, idx) => {
        const done = idx <= activeIndex && activeIndex !== -1;
        const isCurrent = idx === activeIndex && !isCancelled && !isRefunded;
        const isTerminal = isCancelled || isRefunded;
        const isLast = idx === steps.length - 1;

        return (
          <div key={step.key} className="flex items-start gap-4">
            {/* Indicator column */}
            <div className="flex flex-col items-center">
              <div
                className={clsx(
                  "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition-all duration-300",
                  isTerminal
                    ? "border-2 border-accent-red text-accent-red bg-accent-red/10"
                    : isCurrent
                    ? "bg-brand text-white shadow-md shadow-brand/30 ring-4 ring-brand/20"
                    : done
                    ? "bg-brand text-white"
                    : "border-2 border-light-divider text-ink-muted bg-light-surface"
                )}
              >
                {isTerminal ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : done && !isCurrent ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>
              {/* Connector line */}
              {!isLast && (
                <div
                  className={clsx(
                    "w-0.5 h-10 transition-colors duration-300",
                    isTerminal
                      ? "bg-accent-red/20"
                      : done
                      ? "bg-brand/40"
                      : "bg-light-divider"
                  )}
                />
              )}
            </div>
            {/* Text content */}
            <div className={clsx("pt-2 pb-2", !isLast && "pb-0")}>
              <p
                className={clsx(
                  "font-semibold text-[15px] leading-tight",
                  isTerminal
                    ? "text-accent-red"
                    : isCurrent
                    ? "text-ink"
                    : done
                    ? "text-ink"
                    : "text-ink-muted"
                )}
              >
                {isCancelled
                  ? t("statusCancelled")
                  : isRefunded
                  ? t("statusRefunded")
                  : t(step.labelKey)}
              </p>
              <p
                className={clsx(
                  "text-sm mt-0.5",
                  isCurrent ? "text-ink-muted" : "text-ink-muted/70"
                )}
              >
                {isCancelled
                  ? t("descOrderCancelled")
                  : isRefunded
                  ? t("descPaymentRefunded")
                  : step.key === "payment" && paymentStatus === "paid"
                  ? t("descPaymentComplete")
                  : t(step.descKey)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
