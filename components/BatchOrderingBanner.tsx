"use client";

import { useEffect, useState } from "react";
import type { BatchFulfillmentConfigResponse } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

type OrderType = "pickup" | "delivery" | "dine_in";

/**
 * Editorial date-stamp banner — Mamie-TLV-style weekly batch ordering.
 *
 * Visual concept: a printed weekly bulletin. A boxed day number on the leading
 * edge (like a tear-off calendar) anchors the eye; a serif date headline reads
 * as the masthead; a tabular countdown on the trailing edge keeps urgency
 * tangible; a thin animated progress bar at the bottom shows how much of the
 * ordering window remains. Subtle grain on the surface for printed-paper feel.
 *
 * Renders `null` when batch mode is off, when no fulfilment days are
 * configured, or for dine-in (the strip is for pickup/delivery flows).
 */
export function BatchOrderingBanner({
  config,
  orderType,
}: {
  config: BatchFulfillmentConfigResponse | null;
  orderType: OrderType;
}) {
  const { t, locale, direction } = useI18n();

  // Re-render every minute so the countdown and progress bar advance on their
  // own. Cheap — one timer per mounted banner, none when batch mode is off.
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
    ? (isPickup
        ? (t("forPickupShort") || "Pour retrait")
        : (t("forDeliveryShort") || "Pour livraison"))
    : (isPickup
        ? (t("nextPickupShort") || "Prochain retrait")
        : (t("nextDeliveryShort") || "Prochaine livraison"));

  const targetIso = open ? config.currentBatchCutoff : config.currentBatchOpenAt;
  const countdown = formatCountdownCompact(targetIso, locale);
  const countdownLabel = open
    ? (t("closesIn") || "Ferme dans")
    : (t("opensIn") || "Ouvre dans");

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
            color-mix(in oklab, ${accent} 9%, transparent),
            color-mix(in oklab, ${accent} 2%, transparent)
          )
        `,
        borderTop: `1px solid color-mix(in oklab, ${accent} 24%, transparent)`,
        borderBottom: `1px solid color-mix(in oklab, ${accent} 14%, transparent)`,
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

      <div className="relative mx-auto flex max-w-6xl items-center gap-3 px-3 py-2.5 sm:gap-5 sm:px-6 sm:py-3">
        {/* Date stamp — the visual anchor. Boxed day number with weekday and
            month set as small caps above/below. Looks like a tear-off page
            from a calendar; gives the strip a memorable silhouette. */}
        <DateStamp weekday={stamp.weekday} day={stamp.day} month={stamp.month} accent={accent} />

        {/* Title block — uppercase eyebrow + serif date headline */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            className="text-[9.5px] font-semibold uppercase leading-none text-[var(--text-primary)]/55 sm:text-[10px]"
            style={{ letterSpacing: "0.22em" }}
          >
            {fulfilmentLabel}
          </span>
          <span
            className="truncate text-[15px] leading-tight text-[var(--text-primary)] sm:text-[17px]"
            style={{
              fontFamily:
                "var(--font-serif, ui-serif, 'Cormorant Garamond', Georgia, 'Times New Roman', serif)",
              letterSpacing: "-0.005em",
              fontWeight: 500,
            }}
          >
            {dateLine}
          </span>
        </div>

        {/* Countdown — tabular numbers so digit changes don't jitter */}
        {countdown && (
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <span
              className="text-[9.5px] font-semibold uppercase leading-none text-[var(--text-primary)]/55 sm:text-[10px]"
              style={{ letterSpacing: "0.22em" }}
            >
              {countdownLabel}
            </span>
            <span
              className="text-[14px] font-semibold leading-none text-[var(--text-primary)] sm:text-[15px]"
              style={{
                fontVariantNumeric: "tabular-nums",
                fontFeatureSettings: "'tnum' 1",
                letterSpacing: "0.01em",
              }}
            >
              {countdown}
            </span>
          </div>
        )}
      </div>

      {/* Progress bar — fills as the ordering window elapses. Tiny inline
          keyframes give it a slow shimmer so the strip feels alive without
          being noisy. Only shown in the OPEN state. */}
      {progress !== null && (
        <div
          aria-hidden
          className="relative h-[2px] w-full"
          style={{ background: `color-mix(in oklab, ${accent} 10%, transparent)` }}
        >
          <div
            className="absolute inset-y-0 transition-[width] duration-700 ease-out"
            style={{
              [direction === "rtl" ? "right" : "left"]: 0,
              width: `${Math.min(100, Math.max(0, progress * 100))}%`,
              background: `linear-gradient(90deg, ${accent} 0%, color-mix(in oklab, ${accent} 60%, transparent) 100%)`,
              boxShadow: `0 0 8px color-mix(in oklab, ${accent} 50%, transparent)`,
            }}
          />
        </div>
      )}
    </section>
  );
}

/* ──────────────────────────── Date stamp piece ──────────────────────────── */

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
        background: `color-mix(in oklab, ${accent} 10%, transparent)`,
        border: `1px solid color-mix(in oklab, ${accent} 35%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${accent} 8%, transparent)`,
        minWidth: 42,
      }}
    >
      <span
        className="text-[8.5px] font-bold uppercase text-[var(--text-primary)]/60"
        style={{ letterSpacing: "0.16em" }}
      >
        {weekday}
      </span>
      <span
        className="text-[18px] font-bold text-[var(--text-primary)] sm:text-[20px]"
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
        className="text-[8.5px] font-bold uppercase text-[var(--text-primary)]/60"
        style={{ letterSpacing: "0.16em", marginTop: 1 }}
      >
        {month}
      </span>
    </div>
  );
}

/* ───────────────────────────── Date formatting ──────────────────────────── */

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

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toLocaleUpperCase() + s.slice(1);
}

/**
 * Compact, glanceable countdown.
 *   > 1 day  → "2j 14h"   / "2d 14h"   / "2 י׳ 14 ש׳"
 *   > 1 hour → "14h 32m"  / "14h 32m"  / "14 ש׳ 32 ד׳"
 *   < 1 hour → "32 min"   / "32 min"   / "32 ד׳"
 */
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
