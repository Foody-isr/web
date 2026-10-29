import type { OrderLifecycleV2Read } from './order-lifecycle-v2';
import type { OrderLifecycleRead } from "./order-lifecycle";

/** Only invalidate the current order; never apply a partial WebSocket payload. */
export function isCurrentOrderEvent(value: unknown, orderId: string, restaurantId: string): boolean {
  if (!value || typeof value !== 'object') return false;
  const event = value as Record<string, unknown>;
  const payload = event.payload && typeof event.payload === 'object' ? event.payload as Record<string, unknown> : event;
  for (const id of [event.order_id, payload.order_id, payload.id]) {
    if (id != null && String(id) !== orderId) return false;
  }
  for (const id of [event.restaurant_id, payload.restaurant_id]) {
    if (id != null && String(id) !== restaurantId) return false;
  }
  if (typeof event.type === 'string') {
    return event.type.startsWith('order.') || event.type === 'payment.completed';
  }
  // Old scoped guest sockets sent only a status object.
  return typeof payload.status === 'string' || typeof payload.order_status === 'string';
}


/** Pending alone is expected payment; existing Pay now and provider guards remain authoritative. */
export function orderCollectionAllowed(lifecycle?: OrderLifecycleRead, lifecycleV2?: OrderLifecycleV2Read): boolean {
  if (lifecycleV2 && lifecycleV2.kind !== 'legacy') {
    if (lifecycleV2.kind !== 'available') return false;
    const { state, amounts } = lifecycleV2.value.payment;
    return ['unpaid', 'pending', 'partially_paid'].includes(state) && typeof amounts.balance_due_minor === 'number' && amounts.balance_due_minor > 0;
  }
  if (!lifecycle || lifecycle.kind === 'legacy') return true;
  return lifecycle.kind === 'available' && ['unpaid', 'pending', 'partially_paid'].includes(lifecycle.value.payment.state);
}
