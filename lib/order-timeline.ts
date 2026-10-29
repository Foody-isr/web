import type { OrderLifecycleV2Read } from './order-lifecycle-v2';
import type { OrderLifecycleRead } from "./order-lifecycle";
import type { OrderStatus, OrderType } from "./types";

export type OrderTimelineStep = { key: string; labelKey: string; descKey: string };

/** Dine-in flow for table service when staff approval is required */
const dineInSteps: OrderTimelineStep[] = [
  { key: "accepted", labelKey: "statusAccepted", descKey: "descConfirmedByStaff" },
  { key: "in_kitchen", labelKey: "statusInKitchen", descKey: "descCookingStarted" },
  { key: "ready", labelKey: "statusReady", descKey: "descReadyToBeServed" },
  { key: "served", labelKey: "statusServed", descKey: "descDeliveredToTable" },
];

/** Dine-in flow for counter service when staff approval is required */
const dineInCounterSteps: OrderTimelineStep[] = [
  { key: "accepted", labelKey: "statusAccepted", descKey: "descConfirmedByStaff" },
  { key: "in_kitchen", labelKey: "statusInKitchen", descKey: "descCookingStarted" },
  { key: "ready", labelKey: "statusReady", descKey: "descPickUpAtCounter" },
  { key: "served", labelKey: "statusPickedUp", descKey: "descCollected" },
];

const pickupSteps: OrderTimelineStep[] = [
  { key: "pending_review", labelKey: "statusPending", descKey: "descAwaitingApproval" },
  { key: "accepted", labelKey: "statusAccepted", descKey: "descConfirmedByStaff" },
  { key: "in_kitchen", labelKey: "statusInKitchen", descKey: "descCookingStarted" },
  { key: "ready", labelKey: "statusReady", descKey: "descReadyForPickup" },
  { key: "served", labelKey: "statusPickedUp", descKey: "descCollectedByCustomer" },
];

const deliverySteps: OrderTimelineStep[] = [
  { key: "pending_review", labelKey: "statusPending", descKey: "descAwaitingApproval" },
  { key: "accepted", labelKey: "statusAccepted", descKey: "descConfirmedByStaff" },
  { key: "in_kitchen", labelKey: "statusInKitchen", descKey: "descCookingStarted" },
  { key: "ready_for_delivery", labelKey: "statusReadyForDelivery", descKey: "descReadyForDelivery" },
  { key: "out_for_delivery", labelKey: "statusOnTheWay", descKey: "descOutForDelivery" },
  { key: "delivered", labelKey: "statusDelivered", descKey: "descDeliveredToYou" },
];

/** Scheduled pickup flow (batch fulfillment) */
const scheduledPickupSteps: OrderTimelineStep[] = [
  { key: "scheduled", labelKey: "statusScheduled", descKey: "descScheduledOrder" },
  { key: "pending_review", labelKey: "statusPending", descKey: "descAwaitingApproval" },
  { key: "accepted", labelKey: "statusAccepted", descKey: "descConfirmedByStaff" },
  { key: "in_kitchen", labelKey: "statusInKitchen", descKey: "descCookingStarted" },
  { key: "ready", labelKey: "statusReady", descKey: "descReadyForPickup" },
  { key: "served", labelKey: "statusPickedUp", descKey: "descCollectedByCustomer" },
];

/** Scheduled delivery flow (batch fulfillment) */
const scheduledDeliverySteps: OrderTimelineStep[] = [
  { key: "scheduled", labelKey: "statusScheduled", descKey: "descScheduledOrder" },
  { key: "pending_review", labelKey: "statusPending", descKey: "descAwaitingApproval" },
  { key: "accepted", labelKey: "statusAccepted", descKey: "descConfirmedByStaff" },
  { key: "in_kitchen", labelKey: "statusInKitchen", descKey: "descCookingStarted" },
  { key: "ready_for_delivery", labelKey: "statusReadyForDelivery", descKey: "descReadyForDelivery" },
  { key: "out_for_delivery", labelKey: "statusOnTheWay", descKey: "descOutForDelivery" },
  { key: "delivered", labelKey: "statusDelivered", descKey: "descDeliveredToYou" },
];

function getStepsForOrderType(
  orderType?: OrderType,
  serviceMode?: string,
  scheduled = false
): OrderTimelineStep[] {
  const isScheduledFlow = scheduled;

  switch (orderType) {
    case "pickup":
      return isScheduledFlow ? scheduledPickupSteps : pickupSteps;
    case "delivery":
      return isScheduledFlow ? scheduledDeliverySteps : deliverySteps;
    case "dine_in": {
      // A status does not reveal whether approval was configured. Keep the
      // journey stable as the order progresses instead of inferring settings.
      return serviceMode === "counter" ? dineInCounterSteps : dineInSteps;
    }
    default:
      return dineInSteps;
  }
}

/** Resolve only operational evidence; payment and refunds never advance food. */
export function legacyOrderTimeline(input: {
  status: OrderStatus;
  orderType?: OrderType;
  serviceMode?: string;
  scheduledFor?: string;
}) {
  const { status, orderType, serviceMode } = input;
  const steps = getStepsForOrderType(orderType, serviceMode, !!input.scheduledFor || status === "scheduled");
  let operationalStatus: string = status;
  if (status === "ready_for_pickup" && orderType === "pickup") operationalStatus = "ready";
  if (status === "received" && orderType !== "delivery") operationalStatus = "served";
  if (status === "picked_up" && (orderType === "pickup" || serviceMode === "counter")) operationalStatus = "served";
  const activeIndex = steps.findIndex(step => step.key === operationalStatus);
  return {
    steps,
    activeIndex,
    cancelled: status === "cancelled" || status === "rejected",
    unknown: activeIndex < 0 && status !== "cancelled" && status !== "rejected",
    done: new Set(steps.filter((_, index) => index <= activeIndex).map(step => step.key)),
    current: new Set(activeIndex < 0 ? [] : [steps[activeIndex].key]),
    message: undefined as string | undefined,
  };
}

/** Project preparation and handoff independently; a financial closure proves neither. */
export function orderTimeline(input: Parameters<typeof legacyOrderTimeline>[0] & { lifecycle?: OrderLifecycleRead; lifecycleV2?: OrderLifecycleV2Read }) {
  const legacy = legacyOrderTimeline(input);
  const v2 = input.lifecycleV2 && input.lifecycleV2.kind !== 'legacy' ? input.lifecycleV2 : undefined;
  if (!v2 && (!input.lifecycle || input.lifecycle.kind === 'legacy')) return legacy;
  const steps = legacy.steps.filter(step => step.key !== 'accepted' && step.key !== 'pending_review');
  const result = { ...legacy, steps, activeIndex: -1, done: new Set<string>(), current: new Set<string>(), unknown: false };
  if (v2?.kind === 'unavailable' || !v2 && input.lifecycle?.kind === 'unavailable') return { ...result, unknown: true };
  const facts = v2?.kind === 'available' ? v2.value : input.lifecycle?.kind === 'available' ? input.lifecycle.value : undefined;
  if (!facts) return { ...result, unknown: true };
  const { preparation, handoff, commercial } = facts;
  if (preparation.state === 'not_tracked') result.steps = result.steps.filter(step => !['in_kitchen', 'ready', 'ready_for_delivery'].includes(step.key));
  result.cancelled = commercial.state === 'cancelled';
  if (preparation.state === 'ready') {
    result.done.add('in_kitchen');
    result.done.add(input.orderType === 'delivery' ? 'ready_for_delivery' : 'ready');
    result.current.add(input.orderType === 'delivery' ? 'ready_for_delivery' : 'ready');
  } else if (preparation.state === 'in_progress' || preparation.state === 'partially_ready') {
    result.done.add('in_kitchen');
    result.current.add('in_kitchen');
    if (preparation.state === 'partially_ready') result.message = 'orderPreparationPartiallyReady';
  } else if (preparation.state === 'held') result.message = 'orderPreparationHeld';
  else if (preparation.state === 'not_sent') result.message = 'orderPreparationNotSent';
  else if (preparation.state !== 'not_tracked') result.unknown = true;
  if (handoff.state === 'complete') {
    result.current.clear();
    const key = input.orderType === 'delivery' ? 'delivered' : 'served';
    result.done.add(key);
    result.current.add(key);
  } else if (handoff.state === 'in_transit' && input.orderType === 'delivery') {
    result.current.clear();
    result.done.add('out_for_delivery');
    result.current.add('out_for_delivery');
  } else if (handoff.state === 'partially_complete') {
    result.message = 'orderHandoffPartiallyComplete';
  } else if (handoff.tracking === 'not_tracked' || handoff.state === 'not_tracked') {
    result.steps = result.steps.filter(step => !['served', 'delivered', 'out_for_delivery'].includes(step.key));
    result.message = 'orderHandoffNotTracked';
  }
  result.activeIndex = result.steps.findIndex(step => result.current.has(step.key));
  return result;
}

/** Current operational event for notifications; money never creates a food event. */
export function trackedOperationalStatus(status: OrderStatus, orderType?: OrderType, lifecycle?: OrderLifecycleRead, lifecycleV2?: OrderLifecycleV2Read): OrderStatus | undefined {
  const v2 = lifecycleV2 && lifecycleV2.kind !== 'legacy' ? lifecycleV2 : undefined;
  if (!v2 && (!lifecycle || lifecycle.kind === 'legacy')) return status;
  if (v2?.kind === 'unavailable' || !v2 && lifecycle?.kind === 'unavailable') return undefined;
  const facts = v2?.kind === 'available' ? v2.value : lifecycle?.kind === 'available' ? lifecycle.value : undefined;
  if (!facts) return undefined;
  if (facts.handoff.state === 'complete') return orderType === 'delivery' ? 'delivered' : orderType === 'pickup' ? 'picked_up' : 'served';
  if (facts.handoff.state === 'in_transit' && orderType === 'delivery') return 'out_for_delivery';
  if (facts.preparation.state === 'ready') return orderType === 'delivery' ? 'ready_for_delivery' : 'ready';
  if (facts.preparation.state === 'in_progress' || facts.preparation.state === 'partially_ready') return 'in_kitchen';
  return undefined;
}
