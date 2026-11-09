"use client";

import { useId, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { formatLongDateLabel } from "@/lib/scheduling";
import type { SchedulingTimeSlot } from "@/lib/types";
import { CheckoutFieldLabel, checkoutControlClass } from "@/components/CheckoutBuilderFields";

type Props = {
  slotsByDate: Record<string, SchedulingTimeSlot[]>;
  selectedDate: string | null;
  selectedSlot: SchedulingTimeSlot | null;
  onDateChange: (date: string) => void;
  onSlotChange: (slot: SchedulingTimeSlot) => void;
};

const localeTags = { en: "en-US", fr: "fr-FR", he: "he-IL" };

function slotKey(slot: SchedulingTimeSlot) {
  return `${slot.start}|${slot.end}`;
}

/** Browse the offered dates one month at a time and choose a slot for the selected day. */
export function CheckoutScheduleCalendar({ slotsByDate, selectedDate, selectedSlot, onDateChange, onSlotChange }: Props) {
  const { locale, t } = useI18n();
  const slotId = useId();
  const [browse, setBrowse] = useState<{ month: string; selectedDate: string | null }>();
  const months = useMemo(() => [...new Set(
    Object.keys(slotsByDate).filter(date => slotsByDate[date].length > 0).sort().map(date => date.slice(0, 7)),
  )], [slotsByDate]);

  if (!months.length) return null;
  const selectedMonth = selectedDate?.slice(0, 7);
  const month = browse?.selectedDate === selectedDate && months.includes(browse.month)
    ? browse.month
    : selectedMonth && months.includes(selectedMonth) ? selectedMonth : months[0];

  // The API's dates are calendar days in the restaurant's timezone. UTC
  // arithmetic here keeps the grid independent of the browser's timezone.
  const first = new Date(`${month}-01T00:00:00Z`);
  const monthLabel = new Intl.DateTimeFormat(localeTags[locale], { month: "long", year: "numeric", timeZone: "UTC" });
  const firstWeekday = locale === "fr" ? 1 : 0;
  const offset = (first.getUTCDay() - firstWeekday + 7) % 7;
  const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const weekCount = Math.ceil((offset + daysInMonth) / 7);
  const weekdays = new Intl.DateTimeFormat(localeTags[locale], { weekday: locale === "he" ? "narrow" : "short", timeZone: "UTC" });
  const longWeekdays = new Intl.DateTimeFormat(localeTags[locale], { weekday: "long", timeZone: "UTC" });
  const slots = selectedDate ? slotsByDate[selectedDate] ?? [] : [];
  const currentSlot = selectedSlot && slots.some(slot => slotKey(slot) === slotKey(selectedSlot)) ? slotKey(selectedSlot) : "";

  return (
    <div className="max-w-md space-y-4" data-checkout-schedule>
      <div className="rounded-lg border border-[var(--divider)] p-2.5 sm:p-3">
        {months.length > 1 ? (
          <select aria-label={t("checkoutScheduleMonth")} className={checkoutControlClass} value={month}
            onChange={event => setBrowse({ month: event.target.value, selectedDate })}>
            {months.map(value => (
              <option key={value} value={value}>{monthLabel.format(new Date(`${value}-01T00:00:00Z`))}</option>
            ))}
          </select>
        ) : <p className="px-2 pt-1 text-sm font-semibold">{monthLabel.format(first)}</p>}

        <table aria-label={monthLabel.format(first)} className="mt-2 w-full table-fixed border-separate border-spacing-0.5 text-center">
          <thead>
            <tr>
              {Array.from({ length: 7 }, (_, index) => {
                const weekday = new Date(Date.UTC(2024, 0, 7 + firstWeekday + index));
                return <th key={index} scope="col" aria-label={longWeekdays.format(weekday)}
                  className="pb-1 text-xs font-medium text-[var(--text-muted)]">{weekdays.format(weekday)}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: weekCount }, (_, week) => (
              <tr key={week}>
                {Array.from({ length: 7 }, (_, index) => {
                  const day = week * 7 + index - offset + 1;
                  if (day < 1 || day > daysInMonth) return <td key={index} />;
                  const date = `${month}-${String(day).padStart(2, "0")}`;
                  const enabled = !!slotsByDate[date]?.length;
                  const selected = enabled && date === selectedDate;
                  return (
                    <td key={index}>
                      <button type="button" disabled={!enabled} aria-label={formatLongDateLabel(date, locale)}
                        aria-pressed={selected} onClick={() => onDateChange(date)}
                        className={`h-9 w-full rounded-md text-sm tabular-nums sm:h-10 ${selected
                          ? "bg-[var(--brand)] font-semibold text-[var(--ink-on-accent,#fff)]"
                          : "text-[var(--text)] enabled:hover:bg-[var(--surface-subtle)]"}`}>
                        {day}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedDate && slots.length > 0 && (
        <div>
          <CheckoutFieldLabel htmlFor={slotId} text={t("time")} required />
          <p className="mb-2 text-xs text-[var(--text-muted)]" id={`${slotId}-date`}>
            {formatLongDateLabel(selectedDate, locale)}
          </p>
          <select id={slotId} aria-describedby={`${slotId}-date`} className={checkoutControlClass} required value={currentSlot}
            onChange={event => {
              const slot = slots.find(value => slotKey(value) === event.target.value);
              if (slot) onSlotChange(slot);
            }}>
            <option value="" disabled>{t("chooseATime")}</option>
            {slots.map(slot => <option key={slotKey(slot)} value={slotKey(slot)}>{`\u2066${slot.start} – ${slot.end}\u2069`}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}
