"use client";
import { useQuery } from "@tanstack/react-query";
import type { OrderResponse } from "@/lib/types";
import { fetchOrder } from "@/services/api";
import { useI18n } from "@/lib/i18n";
import { formatDateLabel } from "@/lib/scheduling";

/** Keep the customer's delivery promise current after staff assigns its time. */
export function OrderDeliveryPromise({ order, restaurantId, receiptToken, preview = false }: { order: OrderResponse; restaurantId: string; receiptToken?: string; preview?: boolean }) {
  const { t, locale } = useI18n();
  const query = useQuery({ queryKey: ['delivery-promise', restaurantId, order.orderId, receiptToken], queryFn: () => fetchOrder(order.orderId, restaurantId, receiptToken), initialData: order, enabled: !preview && !!receiptToken && order.orderType === 'delivery' && !!order.deliveryScheduleMode, refetchInterval: current => ['delivered', 'cancelled', 'refunded', 'rejected'].includes(current.state.data?.orderStatus ?? '') ? false : 15000, refetchIntervalInBackground: false });
  const promise = query.data;
  if (promise.orderType !== 'delivery' || !promise.deliveryScheduleMode) return null;
  return <section className="card space-y-2 p-4" aria-label={t('deliveryCalendarTitle')}>
    <h3 className="font-semibold">{t('deliveryCalendarTitle')}</h3>
    <p role="status">{promise.scheduledFor ? formatDateLabel(promise.scheduledFor, locale) : ''}{promise.deliverySlotPending ? ` · ${t('deliverySlotPending')}` : promise.scheduledWindowStart && promise.scheduledWindowEnd ? ` · ${promise.scheduledWindowStart}–${promise.scheduledWindowEnd}` : ''}</p>
    {promise.deliverySlotPending && promise.deliveryEstimate && <p>{t('deliveryEstimatedArrival')} : <bdi>{promise.deliveryEstimate.windows.map(window => `${window.start}–${window.end}`).join(' / ')}</bdi></p>}
    {promise.deliverySlotPending && <p className="text-sm text-[var(--text-muted)]">{t('deliverySlotPendingHint')}</p>}
  </section>;
}
