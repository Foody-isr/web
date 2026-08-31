"use client";

import type { ChangeEvent } from "react";
import type { Locale } from "@/lib/i18n";

function datePlaceholder(locale: Locale): string {
  if (locale === "he") return "יום/חודש/שנה";
  return locale === "fr" ? "jj/mm/aaaa" : "dd/mm/yyyy";
}

function displayDate(value: string, locale: Locale): string {
  if (!value) return datePlaceholder(locale);
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

export function CateringDateInput({
  value,
  onChange,
  locale,
  id,
  ariaLabel,
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  locale: Locale;
  id?: string;
  ariaLabel?: string;
  compact?: boolean;
}) {
  return (
    <span className={`relative block w-full min-w-0 max-w-full overflow-hidden border border-[var(--divider)] bg-[var(--surface)] text-[var(--text)] focus-within:ring-2 focus-within:ring-[var(--catering-accent,var(--brand))] ${compact ? "min-h-10 rounded-lg px-3 py-2 text-sm" : "min-h-12 rounded-xl px-4 py-3"}`}>
      <span aria-hidden="true" className="pointer-events-none flex min-w-0 items-center justify-between gap-3">
        <span className={`min-w-0 truncate ${value ? "text-[var(--text)]" : "text-[var(--text-muted)]"}`}>
          {displayDate(value, locale)}
        </span>
        <svg className="h-5 w-5 shrink-0 text-[var(--text)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 2v3M17 2v3M3.5 9h17" />
          <rect x="3.5" y="4" width="17" height="17" rx="2.5" />
        </svg>
      </span>
      <input
        id={id}
        type="date"
        value={value}
        aria-label={ariaLabel}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
      />
    </span>
  );
}
