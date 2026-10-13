"use client";

import { useI18n } from "@/lib/i18n";
import { formatDateLabel, formatWeekday, type SchedulingSelection } from "@/lib/scheduling";
import type { SchedulingTimeSlot } from "@/lib/types";

/** Shared accessible date and slot controls for storefront fulfillment dialogs. */
export function SchedulingFields({ slotsByDate, selection, onChange, disabled = false }: {
  slotsByDate: Record<string, SchedulingTimeSlot[]>;
  selection: SchedulingSelection | null;
  onChange: (selection: SchedulingSelection) => void;
  disabled?: boolean;
}) {
  const { locale, t } = useI18n();
  const dates = Object.keys(slotsByDate).filter(date => slotsByDate[date].length > 0).sort();
  const slots = selection ? slotsByDate[selection.scheduledFor] ?? [] : [];
  return <div className="website-schedule-selects">
    <label>{t("date")}<select aria-label={t("date")} disabled={disabled} value={selection?.scheduledFor ?? ""} onChange={event => {
      const date = event.target.value, slot = slotsByDate[date]?.[0];
      if (slot) onChange({ scheduledFor: date, selectedSlot: slot });
    }}>{!selection && <option value="" disabled>{t("chooseATime")}</option>}{dates.map(date => <option key={date} value={date}>{formatWeekday(date, locale)} · {formatDateLabel(date, locale)}</option>)}</select></label>
    <label>{t("time")}<select aria-label={t("time")} disabled={disabled || !selection} value={selection?.selectedSlot.start ?? ""} onChange={event => {
      const slot = slots.find(value => value.start === event.target.value);
      if (selection && slot) onChange({ scheduledFor: selection.scheduledFor, selectedSlot: slot });
    }}>{slots.map(slot => <option key={slot.start} value={slot.start}>{slot.start} – {slot.end}</option>)}</select></label>
  </div>;
}
