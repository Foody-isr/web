"use client";

import { useEffect, useState } from "react";
import type { BatchFulfillmentConfigResponse } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

type OrderType = "pickup" | "delivery" | "dine_in";

/**
 * Editorial weekly-bulletin banner for batch (preorder) restaurants.
 *
 * Three-section composition: a boxed date stamp + serif date headline on the
 * leading edge, the ordering-window cutoff in the middle (the bit that
 * answers "until when can I order?"), and a tabular countdown on the
 * trailing edge — each separated by a hairline rule. A live progress bar at
 * the foot fills as the ordering window elapses.
 *
 * Renders null when batch mode is off, dine-in, or no fulfilment days exist.
 */
export function BatchOrderingBanner({
  config,
  orderType,
}: {
  config: BatchFulfillmentConfigResponse | null;
  orderType: OrderType;
}) {
  const { t, locale, direction } = useI18n();

  // Re-render every minute so the countdown and progress bar advance live.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!config || !config.enabled) return null;
  if (orderType === "dine_in") return null;
  const primaryDay = config.fulfillmentDays?.[0];
  if (!primaryDay) return null;

  const open = config.orderingOpen;
  const isPickup = orderType === "pickup";

  const fulfilmentLabel = open
    ? isPickup
      ? (t("forPickupShort") || "Pour retrait")
      : (t("forDeliveryShort") || "Pour livraison")
    : isPickup
      ? (t("nextPickupShort") || "Prochain retrait")
      : (t("nextDeliveryShort") || "Prochaine livraison");

  const targetIso = open ? config.currentBatchCutoff : config.currentBatchOpenAt;
  const countdown = formatCountdownCompact(targetIso, locale);
  const countdownLabel = open
    ? (t("closesIn") || "Ferme dans")
    : (t("opensIn") || "Ouvre dans");

  // Middle section — the cutoff datetime as a readable date.
  // When open, this is "ordering closes mercredi 18:00".
  // In the gap, the matching cycle's open instead — "reopens mercredi 22:00".
  const cutoffLabel = open
    ? (t("openUntil") || "Ouvert jusqu'à")
    : (t("opensAt") || "Ouvre");
  const cutoffDateTime = formatDateTimeShort(
    open ? config.currentBatchCutoff : config.currentBatchOpenAt,
    locale,
  );

  const progress = open
    ? computeProgress(config.currentBatchOpenAt, config.currentBatchCutoff)
    : null;

  const stamp = buildDateStamp(primaryDay.date, locale);
  const dateLine = formatDateLine(primaryDay.date, locale);

  const accent = open ? "var(--brand-500)" : "var(--warning-500, #d97706)";

  return (
    <section
      dir={direction}
      aria-label={`${fulfilmentLabel} ${dateLine}`}
      className="relative isolate overflow-hidden"
      style={{
        background: `
          linear-gradient(180deg,
            color-mix(in oklab, ${accent} 10%, transparent),
            color-mix(in oklab, ${accent} 2%, transparent)
          )
        `,
        borderTop: `1px solid color-mix(in oklab, ${accent} 26%, transparent)`,
        borderBottom: `1px solid color-mix(in oklab, ${accent} 16%, transparent)`,
      }}
    >
      {/* Grain — printed-paper texture, very subtle. Inline SVG so no asset. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div className="relative mx-auto flex max-w-6xl items-center gap-3 px-3 py-3 sm:gap-5 sm:px-6 sm:py-3.5">
        {/* ── LEFT: date stamp + serif headline ── */}
        <div className="flex items-center gap-3 shrink-0 sm:gap-4">
          <DateStamp
            weekday={stamp.weekday}
            day={stamp.day}
            month={stamp.month}
            accent={accent}
          />
          <Eyebrow label={fulfilmentLabel} primary={dateLine} primaryFamily="serif" />
        </div>

        {/* ── HAIRLINE ── */}
        <Hairline className="hidden md:block" />

        {/* ── MIDDLE: cutoff window (fills the empty space with real info) ── */}
        <div className="hidden flex-1 md:block">
          <Eyebrow label={cutoffLabel} primary={cutoffDateTime} />
        </div>

        {/* ── HAIRLINE ── */}
        <Hairline className="hidden md:block" />

        {/* ── RIGHT: countdown ── */}
        {countdown && (
          <div className="shrink-0 ms-auto md:ms-0">
            <Eyebrow
              label={countdownLabel}
              primary={countdown}
              align="end"
              primaryNumeric
            />
          </div>
        )}
      </div>

      {/* Progress bar — fills as the ordering window elapses. Bumped to 3px
          + brighter mix + a soft glow so it reads as a UI element instead of
          disappearing into the gradient. */}
      {progress !== null && (
        <div
          aria-hidden
          className="relative h-[3px] w-full"
          style={{ background: `color-mix(in oklab, ${accent} 12%, transparent)` }}
        >
          <div
            className="absolute inset-y-0 transition-[width] duration-700 ease-out"
            style={{
              [direction === "rtl" ? "right" : "left"]: 0,
              width: `${Math.min(100, Math.max(0, progress * 100))}%`,
              background: `linear-gradient(90deg, color-mix(in oklab, ${accent} 70%, transparent) 0%, ${accent} 100%)`,
              boxShadow: `0 0 10px color-mix(in oklab, ${accent} 55%, transparent)`,
            }}
          />
        </div>
      )}
    </section>
  );
}

/* ────────────────────────────── Sub-pieces ──────────────────────────────── */

function Eyebrow({
  label,
  primary,
  align = "start",
  primaryFamily,
  primaryNumeric,
}: {
  label: string;
  primary: string;
  align?: "start" | "end";
  primaryFamily?: "serif";
  primaryNumeric?: boolean;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-0.5 ${align === "end" ? "items-end" : ""}`}>
      <span
        className="text-[9.5px] font-semibold uppercase leading-none text-[var(--text-primary)]/55 sm:text-[10px]"
        style={{ letterSpacing: "0.22em" }}
      >
        {label}
      </span>
      <span
        className={`truncate text-[14px] leading-tight text-[var(--text-primary)] sm:text-[16px] ${
          primaryFamily === "serif" ? "" : "font-medium"
        }`}
        style={{
          fontFamily:
            primaryFamily === "serif"
              ? "var(--font-serif, ui-serif, 'Cormorant Garamond', Georgia, 'Times New Roman', serif)"
              : undefined,
          letterSpacing: primaryFamily === "serif" ? "-0.005em" : "0.005em",
          fontWeight: primaryFamily === "serif" ? 500 : undefined,
          fontVariantNumeric: primaryNumeric ? "tabular-nums" : undefined,
          fontFeatureSettings: primaryNumeric ? "'tnum' 1" : undefined,
        }}
      >
        {primary}
      </span>
    </div>
  );
}

function Hairline({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`h-9 w-px shrink-0 ${className}`}
      style={{
        background: `linear-gradient(180deg,
          transparent,
          color-mix(in oklab, var(--text-primary) 14%, transparent) 30%,
          color-mix(in oklab, var(--text-primary) 14%, transparent) 70%,
          transparent
        )`,
      }}
    />
  );
}

function DateStamp({
  weekday,
  day,
  month,
  accent,
}: {
  weekday: string;
  day: string;
  month: string;
  accent: string;
}) {
  return (
    <div
      className="relative flex shrink-0 flex-col items-center justify-center gap-0 rounded-[6px] px-2.5 py-1 leading-none"
      style={{
        background: `color-mix(in oklab, ${accent} 12%, transparent)`,
        border: `1px solid color-mix(in oklab, ${accent} 38%, transparent)`,
        boxShadow: `inset 0 1px 0 color-mix(in oklab, ${accent} 14%, transparent)`,
        minWidth: 46,
      }}
    >
      <span
        className="text-[8.5px] font-bold uppercase text-[var(--text-primary)]/65"
        style={{ letterSpacing: "0.16em" }}
      >
        {weekday}
      </span>
      <span
        className="text-[19px] font-bold text-[var(--text-primary)] sm:text-[21px]"
        style={{
          fontVariantNumeric: "tabular-nums",
          fontFeatureSettings: "'tnum' 1",
          letterSpacing: "-0.02em",
          marginTop: 1,
        }}
      >
        {day}
      </span>
      <span
        className="text-[8.5px] font-bold uppercase text-[var(--text-primary)]/65"
        style={{ letterSpacing: "0.16em", marginTop: 1 }}
      >
        {month}
      </span>
    </div>
  );
}

/* ────────────────────────── Date / time formatting ──────────────────────── */

function localeTag(locale: string): string {
  if (locale === "fr") return "fr-FR";
  if (locale === "he") return "he-IL";
  return locale || "en-US";
}

function buildDateStamp(
  iso: string,
  locale: string,
): { weekday: string; day: string; month: string } {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return { weekday: "", day: iso, month: "" };
  const tag = localeTag(locale);
  const weekday = d
    .toLocaleDateString(tag, { weekday: "short" })
    .replace(".", "")
    .slice(0, 3)
    .toUpperCase();
  const day = String(d.getDate()).padStart(2, "0");
  const month = d
    .toLocaleDateString(tag, { month: "short" })
    .replace(".", "")
    .slice(0, 4)
    .toUpperCase();
  return { weekday, day, month };
}

function formatDateLine(iso: string, locale: string): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return capitalize(
    d.toLocaleDateString(localeTag(locale), {
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
  );
}

function formatDateTimeShort(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const tag = localeTag(locale);
  const date = capitalize(
    d.toLocaleDateString(tag, { weekday: "long", day: "numeric" }),
  );
  const time = d.toLocaleTimeString(tag, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} · ${time}`;
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toLocaleUpperCase() + s.slice(1);
}

function formatCountdownCompact(iso: string, locale: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return "";
  const totalMins = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);
  const mins = totalMins % 60;
  const isFr = locale === "fr";
  const isHe = locale === "he";

  if (days > 0) {
    if (isHe) return `${days} י׳ ${hours} ש׳`;
    return isFr ? `${days}j ${hours}h` : `${days}d ${hours}h`;
  }
  if (hours > 0) {
    const m = String(mins).padStart(2, "0");
    if (isHe) return `${hours} ש׳ ${mins} ד׳`;
    return `${hours}h ${m}m`;
  }
  if (isHe) return `${mins} ד׳`;
  return `${mins} min`;
}

function computeProgress(openIso: string, cutoffIso: string): number | null {
  const open = new Date(openIso).getTime();
  const cutoff = new Date(cutoffIso).getTime();
  const now = Date.now();
  const total = cutoff - open;
  if (!Number.isFinite(total) || total <= 0) return null;
  return Math.max(0, Math.min(1, (now - open) / total));
}
