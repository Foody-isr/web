"use client";
import { useI18n } from "@/lib/i18n";
import { formatDateLabel, type SchedulingSelection } from "@/lib/scheduling";
import type { DeliveryCheckResult } from "@/services/api";
import { SchedulingFields } from "./SchedulingFields";

/** Display the route promise and expose time selection only when policy permits it. */
export function DeliverySchedulePanel({ result, selection, onChange, onPickup, disabled }: { result: DeliveryCheckResult; selection: SchedulingSelection | null; onChange: (value: SchedulingSelection) => void; onPickup?: () => void; disabled?: boolean }) {
  const { t, locale } = useI18n();
  const calendar = result.schedule;
  return <section className="space-y-3 rounded-xl border border-[var(--border)] p-4" aria-label={t('deliveryCalendarTitle')}>
    {calendar && <>
      <p className="font-semibold">{t('deliveryCalendarTitle')}</p>
      {!selection ? <p role="status">{t('deliveryCalendarUnavailable')}</p> : calendar.delivery_mode === 'customer' ? <SchedulingFields slotsByDate={calendar.slots_by_date} selection={selection} onChange={onChange} disabled={disabled} /> : <p role="status">{formatDateLabel(selection.scheduledFor, locale)}{calendar.delivery_mode === 'restaurant' ? ` · ${t('deliverySlotPending')}` : ` · ${selection.selectedSlot.start}–${selection.selectedSlot.end}`}</p>}
      <p className="text-sm text-[var(--text-muted)]">{t(calendar.delivery_mode === 'restaurant' ? 'deliverySlotPendingHint' : 'deliveryCalendarHint')}</p>
    </>}
    {result.offer_pickup && onPickup && <button type="button" className="text-sm underline" disabled={disabled} onClick={onPickup}>{t('deliveryChoosePickup')}</button>}
  </section>;
}
