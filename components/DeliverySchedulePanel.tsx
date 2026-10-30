"use client";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/constants";
import { deliveryModeForDate, formatDateLabel, type SchedulingSelection } from "@/lib/scheduling";
import type { DeliveryCheckResult } from "@/services/api";
import { SchedulingFields } from "./SchedulingFields";

/** Display a server-calculated estimate separately from the confirmed appointment. */
export function DeliverySchedulePanel({ result, selection, onChange, onPickup, disabled, currency }: { currency: string; result: DeliveryCheckResult; selection: SchedulingSelection | null; onChange: (value: SchedulingSelection) => void; onPickup?: () => void; disabled?: boolean }) {
  const { t, locale } = useI18n();
  const calendar = result.schedule;
  const mode = calendar ? deliveryModeForDate(calendar,selection?.scheduledFor) : undefined;
  const day = selection ? calendar?.delivery_day_policies?.[selection.scheduledFor] : undefined;
  const unavailable = Object.values(calendar?.delivery_day_policies ?? {}).find(value=>value.unavailable_reason)?.unavailable_reason;
  return <section className={calendar ? "website-schedule-options space-y-3" : "space-y-3"} aria-label={t('deliveryCalendarTitle')}>
    {calendar && <>
      <p className="website-schedule-title">{t(mode === 'restaurant' && calendar.delivery_mode === 'customer' ? 'deliveryChooseDay' : calendar.delivery_mode === 'customer' ? 'chooseATime' : 'deliveryCalendarTitle')}</p>
      {calendar.delivery_mode === 'customer' ? <SchedulingFields slotsByDate={calendar.slots_by_date} selection={selection} onChange={onChange} disabled={disabled} dateOnly={mode === 'restaurant'} /> : selection ? <p role="status">{formatDateLabel(selection.scheduledFor, locale)}{mode === 'restaurant' ? ` · ${t('deliverySlotPending')}` : ` · ${selection.selectedSlot.start}–${selection.selectedSlot.end}`}</p> : null}
      {!selection && <p role="status">{t('deliveryCalendarUnavailable')}</p>}
      {day?.estimated_windows?.length ? <div role="status"><p>{t('deliveryEstimatedArrival')} : <bdi>{day.estimated_windows.map(window=>`${window.start}–${window.end}`).join(' / ')}</bdi></p><p className="mt-1 text-sm text-[var(--text-muted)]">{t(day.preparation_pending ? 'deliveryEstimateBasketHint' : 'deliveryEstimateHint')}</p></div> : <p className="text-sm text-[var(--text-muted)]">{t(mode === 'restaurant' ? 'deliverySlotPendingHint' : 'deliveryCalendarHint')}</p>}
      {unavailable && <p className="text-sm text-[var(--text-muted)]">{t(unavailable === 'same_day_outside_coverage' ? 'deliveryTodayOutsideCoverage' : unavailable === 'same_day_disabled' ? 'deliveryTodayDisabled' : 'deliveryTodayUnavailable')}</p>}
    </>}
    {result.deliverable && result.delivery_fee != null && Number.isFinite(result.delivery_fee) && <p className="flex items-center justify-between gap-3"><span>{t('deliveryFee')}</span><bdi className="font-semibold">{formatMoney(result.delivery_fee, currency)}</bdi></p>}
    {result.offer_pickup && onPickup && <button type="button" className="text-sm underline" disabled={disabled} onClick={onPickup}>{t('deliveryChoosePickup')}</button>}
  </section>;
}
