"use client";

import { Restaurant, OrderType, BatchFulfillmentConfigResponse } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { ensureFont } from "@/components/sections/typography";
import { currencySymbol } from "@/lib/constants";
import { WifiSheet } from "@/components/WifiSheet";
import Image from "next/image";
import { useEffect, useState } from "react";

function clampPercent(v: number | undefined): number {
  if (typeof v !== "number" || Number.isNaN(v)) return 50;
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
}

type Props = {
  restaurant: Restaurant;
  orderType?: OrderType;
  showBackLink?: boolean;
  compact?: boolean;
  canSwitchOrderType?: boolean;
  onOrderTypeChange?: (type: OrderType) => void;
  /** Pickup/delivery only — opens the OrderDetailsModal. Dine-in ignores this. */
  onOpenOrderDetails?: () => void;
  /** Tapped when the customer hits the "Plus →" pill — opens the About / Info screen. */
  onOpenInfo?: () => void;
  /** Scheduling label (e.g. "Today · 12:00 – 12:30") — shown as a chip when scheduled. */
  schedulingLabel?: string;
  /** Batch fulfillment config — when present, the hero shows a batch-aware pill
   *  in place of the standard "Open · 22:00" closing-hour pill. The closing
   *  hour is meaningless for restaurants that take weekly preorders. */
  batchConfig?: BatchFulfillmentConfigResponse | null;
};

/**
 * Restaurant hero — design handoff from claude.ai/design (Foody Admin Design
 * System). The cover image carries the brand identity overlay:
 *
 *   • Top-left:   glass hamburger button (rendered by TopBar)
 *   • Bottom-left: small uppercase tagline + big bold restaurant name
 *   • Bottom row: horizontal scroll of info pills (Ouvert, Min, Plus →)
 *
 * The order-type / table identity lives in a floating ModeChip rendered by the
 * parent OrderExperience between this hero and the menu content (see chat
 * transcripts: "Two stacked banners → one smart dock" — identity at the top
 * of the dock, CTA at the bottom).
 */
export function RestaurantHero({
  restaurant,
  orderType,
  compact = false,
  onOpenInfo,
  schedulingLabel,
  batchConfig,
}: Props) {
  const { t, locale, direction } = useI18n();
  const websiteConfig = restaurant.websiteConfig;
  const isRTL = direction === "rtl";

  // Tick once a minute so the batch-pill countdown ("2j 22h") advances live.
  // Only mounts the timer when batch mode is actually on for this restaurant.
  const [, setBatchTick] = useState(0);
  const batchEnabled =
    !!restaurant.batchFulfillmentEnabled &&
    !!batchConfig?.enabled &&
    !!batchConfig.fulfillmentDays?.[0];
  useEffect(() => {
    if (!batchEnabled) return;
    const id = setInterval(() => setBatchTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [batchEnabled]);

  const heroNameFont = websiteConfig?.heroNameFont;
  const hideHeroLogo = websiteConfig?.hideHeroLogo ?? false;
  useEffect(() => {
    ensureFont(heroNameFont);
  }, [heroNameFont]);

  // Compact mode keeps the hero proportional on the menu page; non-compact
  // (landing route) gets the larger editorial treatment.
  const heroHeightClass = compact
    ? "h-[44vh] min-h-[300px] max-h-[440px]"
    : "h-[60vh] sm:h-[64vh] lg:h-[68vh] min-h-[380px] max-h-[640px]";

  const useDefaultGradient = !restaurant.coverUrl && !restaurant.backgroundColor;
  const tagline = websiteConfig?.tagline || restaurant.description;

  // ── Info pills content
  // Closing time pill — uses opening-hours config if available, else falls
  // back to the raw `openingHours` string the restaurant typed.
  const closingHourLabel = (() => {
    const cfg = restaurant.openingHoursConfig;
    if (cfg) {
      const days: (keyof typeof cfg.dine_in)[] = [
        "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
      ];
      const today = days[new Date().getDay()];
      const slot = cfg[orderType ?? "dine_in"]?.[today];
      if (slot && !slot.closed) return slot.close;
    }
    return restaurant.openingHours ?? null;
  })();

  // Minimum-order applies to both pickup and delivery (it's the same physical
  // constraint — restaurant won't prep an order below this amount). Dine-in
  // doesn't need it (you're already seated).
  const minOrder =
    (orderType === "delivery" || orderType === "pickup") &&
    restaurant.minimumOrderDelivery &&
    restaurant.minimumOrderDelivery > 0
      ? restaurant.minimumOrderDelivery
      : null;

  // WiFi info — currently sourced from websiteConfig.socialLinks.wifi_ssid /
  // wifi_password (defensively read; pill is skipped when missing). When we
  // promote WiFi to a proper admin field, this read site stays the same.
  const wifiSSID =
    orderType === "dine_in" ? websiteConfig?.socialLinks?.wifi_ssid?.trim() : null;
  const wifiPassword =
    orderType === "dine_in" ? websiteConfig?.socialLinks?.wifi_password?.trim() : "";
  const [wifiSheetOpen, setWifiSheetOpen] = useState(false);

  // Fulfilment time — pickup ready time vs. delivery window. We keep both
  // hard-coded for now (the design speccs 15 min and 25–40 min). If/when
  // these become admin-editable, swap to `restaurant.pickupPrepTimeMinutes`
  // etc. without touching the rendering below.
  //
  // Suppressed for restaurants in batch (weekly preorder) mode — the batch
  // pill (see "batch" key below) already carries the correct fulfilment date,
  // and "Ready in 15 min" would mislead.
  const fulfilmentTime: { emoji: string; label: string } | null = (() => {
    if (restaurant.batchFulfillmentEnabled) return null;
    if (orderType === "pickup") {
      return {
        emoji: "🥡",
        label: `${t("readyIn") || "Ready in"} 15 ${t("minutes") || "min"}`,
      };
    }
    if (orderType === "delivery") {
      return { emoji: "🛵", label: `25–40 ${t("minutes") || "min"}` };
    }
    return null;
  })();

  return (
    <div className="relative" dir={direction}>
      {/* Hero Cover */}
      <div className={`relative w-full ${heroHeightClass}`}>
        {restaurant.coverUrl ? (
          restaurant.coverDisplayMode === "repeat" ? (
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${restaurant.coverUrl})`,
                backgroundRepeat: "repeat",
                backgroundSize: "auto 50%",
                backgroundPosition: "left top",
              }}
            />
          ) : (
            <Image
              src={restaurant.coverUrl}
              alt={restaurant.name}
              fill
              sizes="100vw"
              className={restaurant.coverDisplayMode === "contain" ? "object-contain" : "object-cover"}
              style={{
                objectPosition: `${clampPercent(restaurant.coverFocalX)}% ${clampPercent(restaurant.coverFocalY)}%`,
              }}
              priority
            />
          )
        ) : useDefaultGradient ? (
          <div className="absolute inset-0 bg-gradient-to-br from-brand to-brand-dark" />
        ) : (
          <div className="absolute inset-0" style={{ backgroundColor: restaurant.backgroundColor || undefined }} />
        )}

        {/* Legibility gradient — bottom-anchored so the name + pills read clearly */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />

        {/* Soft top gradient under the floating TopBar buttons */}
        <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-black/35 to-transparent pointer-events-none" />

        {/* Title block — small uppercase tagline + big bold name. Sits above
            the info pills and the wave divider that follows. */}
        <div
          className={`absolute inset-x-0 px-5 sm:px-8 lg:px-12 ${
            isRTL ? "text-right" : "text-left"
          }`}
          style={{ bottom: "calc(72px + env(safe-area-inset-bottom, 0px))" }}
        >
          <div className={`max-w-3xl flex flex-col ${isRTL ? "items-end" : "items-start"}`}>
            {restaurant.logoUrl && !hideHeroLogo && (
              <img
                src={restaurant.logoUrl}
                alt={restaurant.name}
                className="sm:hidden h-12 w-auto mb-2 drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]"
              />
            )}
            {tagline && (
              <p
                className={`text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/80 drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)] mb-1`}
              >
                {tagline}
              </p>
            )}
            <h1
              className="text-[42px] leading-[0.98] sm:text-[56px] lg:text-[72px] font-extrabold tracking-[-0.02em] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)]"
              style={heroNameFont ? { fontFamily: `"${heroNameFont}", serif` } : undefined}
            >
              {restaurant.name}
            </h1>
          </div>
        </div>

        {/* Info pills row — glass-style. Info pills cluster on the leading
            edge (with horizontal scroll if they overflow), the "Plus →" pill
            is always pinned to the trailing edge. Per the Claude design,
            pills do NOT have an outline border. */}
        {(() => {
          const pills: React.ReactNode[] = [];

          // Batch-aware status pill takes precedence over the regular closing-
          // hour pill for restaurants in weekly preorder mode. "Open · 22:00"
          // is misleading for them — they're not really open, they're
          // collecting orders for a future fulfillment day. Falls through to
          // the standard pill when batch mode isn't on.
          if (batchEnabled && batchConfig) {
            const primaryDay = batchConfig.fulfillmentDays[0];
            const isOpen = batchConfig.orderingOpen;
            const targetIso = isOpen
              ? batchConfig.currentBatchCutoff
              : batchConfig.currentBatchOpenAt;
            const dateLabel = formatBatchPillDate(primaryDay.date, locale);
            const countdown = formatBatchPillCountdown(targetIso, locale);
            pills.push(
              <GlassPill key="batch">
                {/* Pulse dot — brand color when active, amber in the gap.
                    Matches the visual pattern of the "Open" pill but signals
                    the batch state instead of regular hours. */}
                <span
                  className="w-[7px] h-[7px] rounded-full"
                  style={{
                    background: isOpen ? "#7BD66A" : "#F5A524",
                    boxShadow: isOpen
                      ? "0 0 0 2px rgba(123,214,106,0.3)"
                      : "0 0 0 2px rgba(245,165,36,0.3)",
                    animation: "foody-pulse 2.4s ease-in-out infinite",
                  }}
                />
                {isOpen ? (
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {dateLabel}
                    {countdown && <span className="opacity-65"> · {countdown}</span>}
                  </span>
                ) : (
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {(t("opensAt") || "Opens") + " "}
                    {formatBatchPillReopen(targetIso, locale)}
                  </span>
                )}
              </GlassPill>,
            );
          } else if (closingHourLabel) {
            pills.push(
              <GlassPill key="open">
                <span
                  className="w-[7px] h-[7px] rounded-full"
                  style={{
                    background: "#7BD66A",
                    boxShadow: "0 0 0 2px rgba(123,214,106,0.3)",
                    animation: "foody-pulse 2.4s ease-in-out infinite",
                  }}
                />
                {t("openShort") || "Open"} · {closingHourLabel}
              </GlassPill>,
            );
          }

          if (minOrder !== null) {
            pills.push(
              <GlassPill key="min">
                <span className="text-[13px]">💵</span>
                {t("minShort") || "Min"} {currencySymbol("ILS")}
                {minOrder.toFixed(0)}
              </GlassPill>,
            );
          }

          if (wifiSSID) {
            pills.push(
              <button
                key="wifi"
                onClick={() => setWifiSheetOpen(true)}
                className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-white text-[11.5px] font-bold whitespace-nowrap active:scale-[0.97] transition"
                style={{
                  background: "rgba(255,255,255,0.18)",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                }}
                aria-label={`${t("wifiSheetTitle") || "Connect to WiFi"} — ${wifiSSID}`}
              >
                <span className="text-[13px]">📶</span>
                {t("wifiFree") || "Free WiFi"}
              </button>,
            );
          }

          if (fulfilmentTime) {
            pills.push(
              <GlassPill key="time">
                <span className="text-[13px]">{fulfilmentTime.emoji}</span>
                {fulfilmentTime.label}
              </GlassPill>,
            );
          }

          if (schedulingLabel) {
            pills.push(
              <GlassPill key="schedule">
                <span className="text-[13px]">📅</span>
                {schedulingLabel}
              </GlassPill>,
            );
          }

          return (
            <div
              className={`absolute inset-x-0 flex items-center gap-1.5 px-4 sm:px-8 lg:px-12 ${
                isRTL ? "flex-row-reverse" : ""
              }`}
              style={{ bottom: "calc(28px + env(safe-area-inset-bottom, 0px))" }}
            >
              {/* Info pills cluster — leading edge, horizontally scrollable
                  on overflow. min-w-0 lets it shrink so Plus stays visible.
                  Trailing fade-mask makes overflow read as "swipe to see
                  more" rather than as a hard clip. */}
              <div
                className="flex items-center gap-1.5 overflow-x-auto no-scrollbar min-w-0 flex-shrink"
                style={{
                  WebkitMaskImage:
                    "linear-gradient(to right, black 0, black calc(100% - 24px), transparent 100%)",
                  maskImage:
                    "linear-gradient(to right, black 0, black calc(100% - 24px), transparent 100%)",
                }}
              >
                {pills}
              </div>

              {/* Plus pill — pinned to the trailing edge by margin-auto.
                  Always visible even when info pills overflow / are empty.
                  Text color is hard-coded dark (NOT var(--text-primary)) because
                  the pill background is always white — restaurant themes that
                  set --text-primary to a light color (dark themes / custom
                  fonts loaded via the website editor) would make it invisible.
                  font-bold (700) is used instead of font-extrabold (800) so
                  custom fonts without an 800 weight don't render too thin. */}
              <button
                onClick={onOpenInfo}
                className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white text-[12.5px] font-bold leading-none shadow-[0_4px_12px_rgba(0,0,0,0.18)] hover:bg-white active:scale-[0.97] transition ${
                  isRTL ? "me-auto" : "ms-auto"
                }`}
                style={{ color: "#0F1115" }}
              >
                {t("more") || "Plus"}
                <svg
                  className="w-3 h-3 rtl:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.6}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
                </svg>
              </button>
            </div>
          );
        })()}

        {/* Pulse keyframes for the live dot — scoped to this component */}
        <style>{`
          @keyframes foody-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.55; transform: scale(0.85); }
          }
        `}</style>

      </div>

      {/* Note: the floating "Sur place · Table N" ModeChip is rendered by the
          parent (OrderExperience) so it can subscribe to the live table-session
          state. It overlaps this hero from below. */}

      {/* WiFi credentials sheet — opens when the customer taps the WiFi pill */}
      {wifiSSID && (
        <WifiSheet
          open={wifiSheetOpen}
          onClose={() => setWifiSheetOpen(false)}
          ssid={wifiSSID}
          password={wifiPassword || undefined}
        />
      )}
    </div>
  );
}

/* ───────────────────────────── Glass Pill ──────────────────────────────── */

/* ───────────────────────── Batch pill formatters ─────────────────────────
   Compact, locale-aware. Kept inline so the hero stays a single file and
   doesn't take a new dep just for the batch-mode pill. */

function batchLocaleTag(locale: string): string {
  if (locale === "fr") return "fr-FR";
  if (locale === "he") return "he-IL";
  return locale || "en-US";
}

/** "Ven 12 juin" / "Fri 12 Jun" / "ו׳ 12 יוני" — keeps the pill narrow. */
function formatBatchPillDate(isoDate: string, locale: string): string {
  const d = new Date(isoDate + "T00:00:00");
  if (Number.isNaN(d.getTime())) return isoDate;
  const tag = batchLocaleTag(locale);
  const weekday = d
    .toLocaleDateString(tag, { weekday: "short" })
    .replace(/\.$/, "");
  const month = d
    .toLocaleDateString(tag, { month: "short" })
    .replace(/\.$/, "");
  return `${capitalizeLetter(weekday)} ${d.getDate()} ${month}`;
}

/** "2j 22h" / "2d 22h" / "22h 30m" / "12 min" / Hebrew shorthand. */
function formatBatchPillCountdown(isoDateTime: string, locale: string): string {
  const diffMs = new Date(isoDateTime).getTime() - Date.now();
  if (diffMs <= 0) return "";
  const totalMins = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);
  const mins = totalMins % 60;
  if (locale === "he") {
    if (days > 0) return `${days} י׳ ${hours} ש׳`;
    if (hours > 0) return `${hours} ש׳`;
    return `${mins} ד׳`;
  }
  if (days > 0) return locale === "fr" ? `${days}j ${hours}h` : `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${String(mins).padStart(2, "0")}m`;
  return locale === "fr" ? `${mins} min` : `${mins} min`;
}

/** Reopen label for the gap state — short, e.g. "mer. 22:00". */
function formatBatchPillReopen(isoDateTime: string, locale: string): string {
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return isoDateTime;
  const tag = batchLocaleTag(locale);
  const weekday = d
    .toLocaleDateString(tag, { weekday: "short" })
    .replace(/\.$/, "");
  const time = d.toLocaleTimeString(tag, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${capitalizeLetter(weekday)} ${time}`;
}

function capitalizeLetter(s: string): string {
  return s.length === 0 ? s : s[0].toLocaleUpperCase() + s.slice(1);
}

function GlassPill({ children }: { children: React.ReactNode }) {
  return (
    <div
      // `leading-none` + balanced py prevents the pill from clipping descenders
      // (₪, 350, accented glyphs) against the hero's lower edge on both mobile
      // and desktop. Min-height is set so single-line content always centers.
      className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-[11.5px] font-bold whitespace-nowrap leading-none min-h-[28px]"
      style={{
        background: "rgba(255,255,255,0.18)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      {children}
    </div>
  );
}
