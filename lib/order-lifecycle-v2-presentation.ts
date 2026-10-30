import { formatLifecycleV2Money, type OrderLifecycleV2 } from './order-lifecycle-v2';

/** Recorded amounts stay independent from food and commercial closure. */
export function lifecycleV2MoneyRows(value: OrderLifecycleV2, locale: string, t: (key: string) => string) {
  const rows = [
    ['total_minor', t('lifecycleV2Total')],
    ['captured_minor', t('lifecycleV2RecordedCaptured')],
    ['refunded_minor', t('lifecycleV2RecordedRefunded')],
    ['net_received_minor', t('lifecycleV2RecordedNet')],
    ['balance_due_minor', t('lifecycleV2BalanceDue')],
  ] as const;
  return rows.map(([key, label]) => ({ key, label, value: formatLifecycleV2Money(value.payment.amounts, key, locale) ?? t('lifecycleV2AmountUnknown') }));
}

/** Labels describe one independent axis, never an implied previous stage. */
export function lifecycleV2StateLabel(axis: 'commercial' | 'preparation' | 'handoff', state: string, t: (key: string) => string): string {
  if (axis === 'commercial') {
    switch (state) {
      case 'open': return t('lifecycleV2CommercialOpen');
      case 'closed': return t('lifecycleV2CommercialClosed');
      case 'cancelled': return t('lifecycleV2CommercialCancelled');
      case 'mixed': return t('lifecycleV2Mixed');
      default: return t('lifecycleV2CommercialUnknown');
    }
  }
  if (axis === 'preparation') {
    switch (state) {
      case 'not_sent': return t('lifecycleV2NotSent');
      case 'held': return t('lifecycleV2Held');
      case 'in_progress': return t('lifecycleV2Preparing');
      case 'partially_ready': return t('lifecycleV2PartiallyReady');
      case 'ready': return t('lifecycleV2Ready');
      case 'not_tracked': return t('lifecycleV2NotTracked');
      case 'mixed': return t('lifecycleV2Mixed');
      default: return t('lifecycleV2PreparationUnknown');
    }
  }
  switch (state) {
    case 'pending': return t('lifecycleV2HandoffPending');
    case 'in_transit': return t('lifecycleV2WithCourier');
    case 'partially_complete': return t('lifecycleV2HandoffPartial');
    case 'complete': return t('lifecycleV2HandoffComplete');
    case 'not_tracked': return t('lifecycleV2NotTracked');
    case 'mixed': return t('lifecycleV2Mixed');
    default: return t('lifecycleV2HandoffUnknown');
  }
}
