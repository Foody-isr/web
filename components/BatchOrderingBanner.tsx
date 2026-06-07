"use client";

import type { BatchFulfillmentConfigResponse } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

type OrderType = "pickup" | "delivery" | "dine_in";

/**
 * Persistent status strip shown on the menu and checkout pages when a
 * restaurant is on batch (weekly preorder) mode. Customers always know which
 * batch they're ordering into — vs. discovering it only at checkout.
 *
 * Renders `null` for restaurants that don't have batch fulfillment enabled.
 *
 * Visual treatment: full-width strip with a soft tinted background and a
 * single bottom border — sits between the hero/category-selector cluster and
 * the menu content as a section divider, not as a card/alert.
 */
export function BatchOrderingBanner({
  config,
  orderType,
}: {
  config: BatchFulfillmentConfigResponse | null;
  orderType: OrderType;
}) {
  const { t, locale } = useI18n();

  if (!config || !config.enabled) return null;
  const primaryDay = config.fulfillmentDays?.[0];
  if (!primaryDay) return null;

  const isPickup = orderType === "pickup";
  const verb = isPickup
    ? (t("forPickup") || "for pickup")
    : (t("forDelivery") || "for delivery");

  const dateLabel = formatDateLong(primaryDay.date, locale);
  const mainText = (t("orderingForBatch") || "Ordering {verb} {date}")
    .replace("{verb}", verb)
    .replace("{date}", dateLabel);

  if (config.orderingOpen) {
    const closeIn = formatRelative(config.currentBatchCutoff, locale);
    return (
      <Strip tone="brand">
        <CalendarIcon />
        <span className="font-medium">{mainText}</span>
        {closeIn && (
          <span className="opacity-60 truncate">
            · {(t("closesRelative") || "closes {when}").replace("{when}", closeIn)}
          </span>
        )}
      </Strip>
    );
  }

  // Closed (gap or after final cutoff) — server has shifted "current" to the
  // upcoming cycle, so primaryDay reflects the NEXT batch's fulfilment.
  const reopen = config.currentBatchOpenAt
    ? formatRelative(config.currentBatchOpenAt, locale)
    : "";
  return (
    <Strip tone="warning">
      <ClockIcon />
      <span className="font-medium">{mainText}</span>
      {reopen && (
        <span className="opacity-60 truncate">
          · {(t("opensRelative") || "opens {when}").replace("{when}", reopen)}
        </span>
      )}
    </Strip>
  );
}

// ─── Pieces ────────────────────────────────────────────────────────────────

function Strip({ tone, children }: { tone: "brand" | "warning"; children: React.ReactNode }) {
  const accent = tone === "warning" ? "var(--warning-500, #d97706)" : "var(--brand-500)";
  return (
    <div
      className="flex items-center gap-2 px-4 py-2.5 text-[13px] text-[var(--text-primary)] border-b"
      style={{
        background: `color-mix(in oklab, ${accent} 6%, transparent)`,
        borderColor: `color-mix(in oklab, ${accent} 22%, transparent)`,
      }}
    >
      {children}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg
      className="w-4 h-4 shrink-0 opacity-70"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 7V3m8 4V3M3 11h18M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      className="w-4 h-4 shrink-0 opacity-70"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

// ─── Date formatting ───────────────────────────────────────────────────────

function localeTag(locale: string): string {
  // Map app locales to BCP47 tags that Intl handles best for French/Hebrew.
  if (locale === "fr") return "fr-FR";
  if (locale === "he") return "he-IL";
  return locale || "en-US";
}

function formatDateLong(iso: string, locale: string): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(localeTag(locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/**
 * Human-readable relative phrase for the given target datetime, localised via
 * Intl.RelativeTimeFormat. Returns "" if the target is in the past.
 *
 * Examples (fr): "dans 3 jours", "dans 4 heures", "dans 12 minutes".
 *           (en): "in 3 days",   "in 4 hours",   "in 12 minutes".
 */
function formatRelative(targetIso: string, locale: string): string {
  const diffMs = new Date(targetIso).getTime() - Date.now();
  if (diffMs <= 0) return "";
  const rtf = new Intl.RelativeTimeFormat(localeTag(locale), { numeric: "always" });
  const totalMins = Math.floor(diffMs / 60000);
  if (totalMins < 60) return rtf.format(totalMins, "minute");
  const hours = Math.floor(totalMins / 60);
  if (hours < 24) return rtf.format(hours, "hour");
  const days = Math.floor(hours / 24);
  return rtf.format(days, "day");
}
