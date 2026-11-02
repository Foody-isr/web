"use client";
import type { OrderEventConfig } from "@/services/api";
import { eventOrderCopy } from "@/lib/event-order-copy";

/** Collects event answers while preserving staff-owned payment and date requirements. */
export function EventCheckoutFields({
  config,
  value,
  onChange,
  locale,
  disabled,
}: {
  config: OrderEventConfig;
  value: Pick<
    OrderEventConfig,
    | "name"
    | "guests"
    | "event_date"
    | "event_time"
    | "venue"
    | "contact"
    | "notes"
  >;
  onChange: (
    value: Pick<
      OrderEventConfig,
      | "name"
      | "guests"
      | "event_date"
      | "event_time"
      | "venue"
      | "contact"
      | "notes"
    >,
  ) => void;
  locale: "en" | "fr" | "he";
  disabled: boolean;
}) {
  const c = eventOrderCopy[locale];
  return (
    <section className="commerce-section space-y-5">
      <h2 className="commerce-section-title">{c.information}</h2>
      <p className="commerce-muted text-sm">{c.clientHint}</p>
      <fieldset
        disabled={disabled}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        {(
          [
            "name",
            "guests",
            "event_date",
            "event_time",
            "venue",
            "contact",
            "notes",
          ] as const
        ).map((key) => {
          const required =
            key === "guests"
              ? config.require_guests
              : key === "event_date"
                ? config.require_date
                : key === "event_time"
                  ? config.require_time
                  : false;
          const locked =
            !config.allow_date_change &&
            (key === "event_date" || key === "event_time") &&
            !!config[key];
          return (
            <label key={key} className="flex flex-col gap-2 text-sm">
              {c[key]}
              {required ? " *" : ""}
              <input
                className="w-full px-4 py-3 border border-[var(--divider)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-[var(--surface)] text-[var(--checkout-input,var(--text))]"
                type={
                  key === "guests"
                    ? "number"
                    : key === "event_date"
                      ? "date"
                      : key === "event_time"
                        ? "time"
                        : "text"
                }
                min={key === "guests" ? 1 : undefined}
                max={key === "guests" ? 100000 : undefined}
                maxLength={key === "notes" ? 1000 : key === "venue" ? 500 : 120}
                required={required}
                readOnly={locked}
                value={value[key] || ""}
                onChange={(e) =>
                  onChange({
                    ...value,
                    [key]:
                      key === "guests"
                        ? Number(e.target.value)
                        : e.target.value,
                  })
                }
              />
            </label>
          );
        })}
      </fieldset>
    </section>
  );
}
