"use client";

import { useI18n } from "@/lib/i18n";
import { useId } from "react";
import { formatDateLabel, formatWeekday, resolveSchedulingSelection, type SchedulingSelection } from "@/lib/scheduling";
import type { SchedulingTimeSlot } from "@/lib/types";

/** Shared accessible date and slot controls for storefront fulfillment dialogs. */
export function SchedulingFields({ slotsByDate, selection, onChange, disabled = false, dateOnly = false, list = false }: {
  slotsByDate: Record<string, SchedulingTimeSlot[]>;
  selection: SchedulingSelection | null;
  onChange: (selection: SchedulingSelection) => void;
  disabled?: boolean;
  dateOnly?: boolean;
  list?: boolean;
}) {
  const { locale, t } = useI18n();
  const id = useId();
  const dates = Object.keys(slotsByDate).filter(date => slotsByDate[date].length > 0).sort();
  const slots = selection ? [...(slotsByDate[selection.scheduledFor] ?? [])].sort((a, b) => a.start.localeCompare(b.start)) : [];
  const selectDate = (date: string) => {
    const slot = resolveSchedulingSelection({ [date]: slotsByDate[date] ?? [] })?.selectedSlot;
    if (slot) onChange({ scheduledFor: date, selectedSlot: slot });
  };
  if (list) return (
    <div className="website-schedule-lists">
      <fieldset disabled={disabled}>
        <legend>{t("date")}</legend>
        <div className="website-schedule-options-list">
          {dates.map(date => <label key={date}>
            <input className="sr-only" type="radio" name={`${id}-date`} checked={date === selection?.scheduledFor} onChange={() => selectDate(date)} />
            <span>{formatDateLabel(date, locale)}</span>
          </label>)}
        </div>
      </fieldset>
      {!dateOnly && <fieldset disabled={disabled || !selection}>
        <legend>{t("time")}</legend>
        <div className="website-schedule-options-list">
          {slots.map(slot => <label key={`${slot.start}-${slot.end}`}>
            <input className="sr-only" type="radio" name={`${id}-time`} checked={slot.start === selection?.selectedSlot.start && slot.end === selection?.selectedSlot.end}
              onChange={() => { if (selection) onChange({ scheduledFor: selection.scheduledFor, selectedSlot: slot }); }} />
            <span><bdi>{slot.start} – {slot.end}</bdi></span>
          </label>)}
        </div>
      </fieldset>}
    </div>
  );
  return <div className="website-schedule-selects">
    <label>{t("date")}<select aria-label={t("date")} disabled={disabled} value={selection?.scheduledFor ?? ""} onChange={event => selectDate(event.target.value)}>{!selection && <option value="" disabled>{t("chooseATime")}</option>}{dates.map(date => <option key={date} value={date}>{formatWeekday(date, locale)} · {formatDateLabel(date, locale)}</option>)}</select></label>
    {!dateOnly && <label>{t("time")}<select aria-label={t("time")} disabled={disabled || !selection} value={selection?.selectedSlot.start ?? ""} onChange={event => {
      const slot = slots.find(value => value.start === event.target.value);
      if (selection && slot) onChange({ scheduledFor: selection.scheduledFor, selectedSlot: slot });
    }}>{slots.map(slot => <option key={slot.start} value={slot.start}>{slot.start} – {slot.end}</option>)}</select></label>}
  </div>;
}
