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
  /** Tapped when the customer hits the "More" pill — opens the About / Info screen. */
  onOpenInfo?: () => void;
  /** Scheduling label (e.g. "Today · 12:00 – 12:30") — shown as a chip when scheduled. */
  schedulingLabel?: string;
  /** Batch fulfillment config — when present, the hero suppresses the
   *  closing-hour segment (meaningless for weekly-preorder restaurants; the
   *  date + countdown lives in the ModeChip below). */
  batchConfig?: BatchFulfillmentConfigResponse | null;
};

/**
 * Restaurant hero — Wolt-style brand band.
 *
 *   • Cover photo at the top (carries the imagery only — no text overlay).
 *   • A rounded-square logo box straddles the cover's bottom edge, sitting on a
 *     white or black background (per `websiteConfig.heroLogoBg`). Shown only
 *     when the restaurant actually has a logo — otherwise nothing renders there.
 *   • Restaurant name, then a centered dot-separated info line, then the
 *     interactive WiFi / More chips — all centered on the page background so the
 *     band blends straight into the menu below.
 *
 * The order-type / table identity lives in a floating ModeChip rendered by the
 * parent OrderExperience; it slightly overlaps this band from below.
 */
export function RestaurantHero({
  restaurant,
  orderType,
  compact = false,
  onOpenInfo,
  schedulingLabel,
  batchConfig,
}: Props) {
  const { t, direction } = useI18n();
  const websiteConfig = restaurant.websiteConfig;

  // Used only to suppress the misleading closing-hour segment on batch-mode
  // restaurants. The actual date+countdown UI lives in ModeChip now.
  const batchEnabled =
    !!restaurant.batchFulfillmentEnabled &&
    !!batchConfig?.enabled &&
    !!batchConfig.fulfillmentDays?.[0];

  const heroNameFont = websiteConfig?.heroNameFont;
  // The logo always sits on the hero when present; only its box background is
  // configurable ("white" | "black"), defaulting to white.
  const logoBg = websiteConfig?.heroLogoBg === "black" ? "black" : "white";
  const hasLogo = !!restaurant.logoUrl;
  useEffect(() => {
    ensureFont(heroNameFont);
  }, [heroNameFont]);

  // Cover is now image-only (the name moved off it onto the band), so it can be
  // a touch shorter than the old text-overlay hero.
  const coverHeightClass = compact
    ? "h-[34vh] min-h-[220px] max-h-[320px]"
    : "h-[46vh] min-h-[300px] max-h-[440px]";

  const useDefaultGradient = !restaurant.coverUrl && !restaurant.backgroundColor;
  const tagline = websiteConfig?.tagline || restaurant.description;

  // ── Info line content
  // Closing time — uses opening-hours config if available, else falls back to
  // the raw `openingHours` string the restaurant typed.
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

  // Minimum-order applies to both pickup and delivery (same physical
  // constraint). Dine-in doesn't need it (you're already seated).
  const minOrder =
    (orderType === "delivery" || orderType === "pickup") &&
    restaurant.minimumOrderDelivery &&
    restaurant.minimumOrderDelivery > 0
      ? restaurant.minimumOrderDelivery
      : null;

  // WiFi info — currently sourced from websiteConfig.socialLinks.wifi_ssid /
  // wifi_password (defensively read; chip is skipped when missing).
  const wifiSSID =
    orderType === "dine_in" ? websiteConfig?.socialLinks?.wifi_ssid?.trim() : null;
  const wifiPassword =
    orderType === "dine_in" ? websiteConfig?.socialLinks?.wifi_password?.trim() : "";
  const [wifiSheetOpen, setWifiSheetOpen] = useState(false);

  // Fulfilment time — pickup ready time vs. delivery window. Hard-coded per the
  // design (15 min / 25–40 min); suppressed for batch (weekly preorder) mode.
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

  // Centered dot-separated info segments (Wolt-style). Each entry is one node;
  // separators are interleaved at render time.
  const infoSegments: React.ReactNode[] = [];
  if (!batchEnabled && closingHourLabel) {
    infoSegments.push(
      <span key="open" className="inline-flex items-center gap-1.5">
        <span
          className="w-[7px] h-[7px] rounded-full"
          style={{
            background: "#39C46E",
            boxShadow: "0 0 0 2px rgba(57,196,110,0.22)",
            animation: "foody-pulse 2.4s ease-in-out infinite",
          }}
        />
        {t("openShort") || "Open"} · {closingHourLabel}
      </span>,
    );
  }
  if (minOrder !== null) {
    infoSegments.push(
      <span key="min">
        {t("minShort") || "Min"} {currencySymbol("ILS")}
        {minOrder.toFixed(0)}
      </span>,
    );
  }
  if (fulfilmentTime) {
    infoSegments.push(
      <span key="time">
        {fulfilmentTime.emoji} {fulfilmentTime.label}
      </span>,
    );
  }
  if (schedulingLabel) {
    infoSegments.push(
      <span key="sched">📅 {schedulingLabel}</span>,
    );
  }

  return (
    <div className="relative" dir={direction}>
      {/* Cover photo — imagery only, no text overlay */}
      <div className={`relative w-full ${coverHeightClass} overflow-hidden`}>
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

        {/* Soft top gradient so the floating TopBar buttons stay legible */}
        <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-black/35 to-transparent pointer-events-none" />
      </div>

      {/* Brand band — centered logo box + name + info, on the page background so
          it blends straight into the menu. pb leaves room for the ModeChip,
          which overlaps this band slightly from below. */}
      <div className="relative bg-[var(--bg-page)] px-5 pb-8 text-center">
        {hasLogo && (
          <div
            className={`relative mx-auto -mt-[38px] mb-3 w-[76px] h-[76px] rounded-[20px] flex items-center justify-center overflow-hidden border border-[var(--divider)] shadow-[0_8px_24px_rgba(0,0,0,0.30)] ${
              logoBg === "black" ? "bg-black" : "bg-white"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={restaurant.logoUrl}
              alt={restaurant.name}
              className="w-full h-full object-contain p-2.5"
            />
          </div>
        )}

        {tagline && (
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--text-soft)] mb-1">
            {tagline}
          </p>
        )}

        <h1
          className="text-[26px] sm:text-[34px] leading-[1.05] font-extrabold tracking-[-0.02em] text-[var(--text)]"
          style={heroNameFont ? { fontFamily: `"${heroNameFont}", serif` } : undefined}
        >
          {restaurant.name}
        </h1>

        {infoSegments.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[12px] sm:text-[13px] font-medium text-[var(--text-muted)]">
            {infoSegments.map((seg, i) => (
              <span key={i} className="inline-flex items-center gap-x-2">
                {i > 0 && <span aria-hidden className="opacity-40">·</span>}
                {seg}
              </span>
            ))}
          </div>
        )}

        {/* Interactive chips — WiFi (dine-in) opens the credentials sheet,
            More opens the About / Info screen. */}
        <div className="mt-3 flex items-center justify-center gap-2">
          {wifiSSID && (
            <button
              onClick={() => setWifiSheetOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface-subtle)] text-[var(--text)] text-[12px] font-semibold active:scale-[0.97] transition"
              aria-label={`${t("wifiSheetTitle") || "Connect to WiFi"} ${wifiSSID}`}
            >
              <span className="text-[13px]">📶</span>
              {t("wifiFree") || "Free WiFi"}
            </button>
          )}
          <button
            onClick={onOpenInfo}
            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-[var(--surface-subtle)] text-[var(--text)] text-[12px] font-semibold active:scale-[0.97] transition"
          >
            {t("more") || "More"}
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
      </div>

      {/* Pulse keyframes for the live "Open" dot — scoped to this component */}
      <style>{`
        @keyframes foody-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(0.85); }
        }
      `}</style>

      {/* WiFi credentials sheet — opens when the customer taps the WiFi chip */}
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
