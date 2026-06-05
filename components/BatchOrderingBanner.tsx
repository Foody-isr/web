"use client";

import type { BatchFulfillmentConfigResponse } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

type OrderType = "pickup" | "delivery" | "dine_in";

/**
 * Persistent banner shown on the menu page, cart drawer, and checkout when a
 * restaurant is on batch (weekly preorder) mode. Customers always know which
 * batch they're ordering into — vs. discovering it only at checkout.
 *
 * Renders `null` for restaurants that don't have batch fulfillment enabled.
 */
export function BatchOrderingBanner({
  config,
  orderType,
}: {
  config: BatchFulfillmentConfigResponse | null;
  orderType: OrderType;
}) {
  const { t } = useI18n();

  if (!config || !config.enabled) return null;

  // The cycle returned by the server is "current" when ordering is open and
  // "upcoming" when we're in the gap. cutoffAt is always in the future.
  const primaryDay = config.fulfillmentDays?.[0];
  if (!primaryDay) return null;

  // pickup / delivery / dine-in choice — we use the order type to pick which
  // window to display. Dine-in falls back to delivery for the noun choice.
  const windowLabel = orderType === "pickup" ? "pickup" : "delivery";
  const verb = windowLabel === "pickup"
    ? (t("forPickup") || "for pickup")
    : (t("forDelivery") || "for delivery");

  const fulfillmentDateLabel = formatDateLong(primaryDay.date);

  if (config.orderingOpen) {
    const countdown = formatCountdown(config.currentBatchCutoff);
    return (
      <div
        className="px-4 py-3 mx-3 mt-3 rounded-xl border text-sm"
        style={{
          background: "color-mix(in oklab, var(--brand-500) 8%, transparent)",
          borderColor: "color-mix(in oklab, var(--brand-500) 30%, transparent)",
          color: "var(--text-primary)",
        }}
      >
        <div className="font-medium">
          {(t("orderingForBatch") || "Ordering {verb} {date}")
            .replace("{verb}", verb)
            .replace("{date}", fulfillmentDateLabel)}
        </div>
        <div className="text-xs mt-0.5 opacity-80">
          {(t("orderingClosesIn") || "Closes {countdown}").replace("{countdown}", countdown)}
        </div>
      </div>
    );
  }

  // Closed (gap or after final cutoff) — the server has shifted "current" to
  // the upcoming cycle, so `primaryDay` is the NEXT batch's fulfillment.
  const reopenDate = config.currentBatchOpenAt
    ? formatDateTimeShort(config.currentBatchOpenAt)
    : "";

  return (
    <div
      className="px-4 py-3 mx-3 mt-3 rounded-xl border text-sm"
      style={{
        background: "color-mix(in oklab, var(--warning-500, #d97706) 10%, transparent)",
        borderColor: "color-mix(in oklab, var(--warning-500, #d97706) 35%, transparent)",
        color: "var(--text-primary)",
      }}
    >
      <div className="font-medium">
        {(t("thisWeekClosedOrderingNext") || "This week is closed. Ordering {verb} {date}")
          .replace("{verb}", verb)
          .replace("{date}", fulfillmentDateLabel)}
      </div>
      {reopenDate && (
        <div className="text-xs mt-0.5 opacity-80">
          {(t("windowOpensAt") || "Window opens {date}").replace("{date}", reopenDate)}
        </div>
      )}
    </div>
  );
}

function formatDateLong(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

function formatDateTimeShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${day} ${time}`;
}

function formatCountdown(iso: string): string {
  const target = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = target - now;
  if (diffMs <= 0) return "0h";
  const totalMins = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  const mins = totalMins % 60;
  return `${mins}m`;
}
