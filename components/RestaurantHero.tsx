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
  /** Tapped when the customer hits the "More" link — opens the About / Info screen. */
  onOpenInfo?: () => void;
  /** Scheduling label (e.g. "Today · 12:00 – 12:30") — shown when scheduled. */
  schedulingLabel?: string;
  /** Batch fulfillment config — when present, the hero suppresses the
   *  closing-hour segment (meaningless for weekly-preorder restaurants; the
   *  date + countdown lives in the ModeChip below). */
  batchConfig?: BatchFulfillmentConfigResponse | null;
  /** The order-type / fulfilment chip, rendered inline at the start of the web
   *  info row (sm+). On mobile the parent renders it on its own below the band,
   *  so this is shown only at the sm breakpoint. */
  webOrderChip?: React.ReactNode;
  /** Batch (bulk) restaurants whose order type is chosen at checkout have no
   *  order-type selector, so the fulfilment/opening info is shown as plain text
   *  at the start of the info line (Wolt "Open until …" style) instead of a
   *  chip. When set, this string is prepended to the info row and no order chip
   *  is rendered. */
  batchInlineStatus?: string;
};

/**
 * Restaurant hero — Wolt-style brand band, responsive.
 *
 *   • Mobile: a shorter cover, then the logo box straddles its bottom edge,
 *     centered, with the name + a single compact info line centered below.
 *   • Web (sm+): a taller cover with the logo box + name + tagline pinned
 *     bottom-left (overlaid on the cover), and a single horizontal info row
 *     below it.
 *
 * The logo box is white or black per `websiteConfig.heroLogoBg`, shown only
 * when the restaurant has a logo. The order-type / table identity lives in a
 * floating ModeChip rendered by the parent OrderExperience.
 */
export function RestaurantHero({
  restaurant,
  orderType,
  onOpenInfo,
  schedulingLabel,
  batchConfig,
  webOrderChip,
  batchInlineStatus,
}: Props) {
  const { t, direction } = useI18n();
  const websiteConfig = restaurant.websiteConfig;

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

  // Mobile cover is kept short so the menu reaches the fold; web gets a taller
  // editorial cover that carries the bottom-left brand overlay.
  const coverHeightClass =
    "h-[26vh] min-h-[176px] max-h-[248px] sm:h-[32vh] sm:min-h-[230px] sm:max-h-[340px]";

  const useDefaultGradient = !restaurant.coverUrl && !restaurant.backgroundColor;
  const tagline = websiteConfig?.tagline || restaurant.description;
  const nameFontStyle = heroNameFont ? { fontFamily: `"${heroNameFont}", serif` } : undefined;

  // ── Info line content
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

  const minOrder =
    (orderType === "delivery" || orderType === "pickup") &&
    restaurant.minimumOrderDelivery &&
    restaurant.minimumOrderDelivery > 0
      ? restaurant.minimumOrderDelivery
      : null;

  const wifiSSID =
    orderType === "dine_in" ? websiteConfig?.socialLinks?.wifi_ssid?.trim() : null;
  const wifiPassword =
    orderType === "dine_in" ? websiteConfig?.socialLinks?.wifi_password?.trim() : "";
  const [wifiSheetOpen, setWifiSheetOpen] = useState(false);

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

  // One row of items: informational text segments, then the interactive WiFi
  // and More controls. Rendered identically (centered on mobile, left on web).
  const rowItems: React.ReactNode[] = [];
  // Batch + order-type-at-checkout: the opening/fulfilment info leads the line
  // as plain text (no order chip exists for this mode).
  if (batchInlineStatus) {
    rowItems.push(<span key="batch">{batchInlineStatus}</span>);
  }
  if (!batchEnabled && closingHourLabel) {
    rowItems.push(
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
    rowItems.push(
      <span key="min">
        {t("minShort") || "Min"} {currencySymbol("ILS")}
        {minOrder.toFixed(0)}
      </span>,
    );
  }
  if (fulfilmentTime) {
    rowItems.push(
      <span key="time">
        {fulfilmentTime.emoji} {fulfilmentTime.label}
      </span>,
    );
  }
  if (schedulingLabel) {
    rowItems.push(<span key="sched">📅 {schedulingLabel}</span>);
  }
  if (wifiSSID) {
    rowItems.push(
      <button
        key="wifi"
        onClick={() => setWifiSheetOpen(true)}
        className="inline-flex items-center gap-1 font-semibold text-[var(--text)] active:opacity-70 transition"
        aria-label={`${t("wifiSheetTitle") || "Connect to WiFi"} ${wifiSSID}`}
      >
        <span className="text-[13px]">📶</span>
        {t("wifiFree") || "Free WiFi"}
      </button>,
    );
  }
  rowItems.push(
    <button
      key="more"
      onClick={onOpenInfo}
      className="inline-flex items-center gap-0.5 font-semibold text-[var(--brand)] active:opacity-70 transition"
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
    </button>,
  );

  const infoRow = (justify: string) => (
    <div
      className={`flex flex-wrap items-center ${justify} gap-x-2 gap-y-1 text-[12px] sm:text-[13px] font-medium text-[var(--text-muted)]`}
    >
      {rowItems.map((node, i) => (
        <span key={i} className="inline-flex items-center gap-x-2">
          {i > 0 && <span aria-hidden className="opacity-40">·</span>}
          {node}
        </span>
      ))}
    </div>
  );

  return (
    <div className="relative" dir={direction}>
      {/* Cover photo. overflow-visible so the web logo box can straddle the
          bottom edge; the image itself is clipped by an inner layer. */}
      <div className={`relative w-full ${coverHeightClass}`}>
        <div className="absolute inset-0 overflow-hidden">
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
          {/* Web-only bottom gradient so the white brand text reads on the cover */}
          <div className="hidden sm:block absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent pointer-events-none" />
        </div>

        {/* WEB brand overlay — logo box + name + tagline pinned bottom-left,
            sitting entirely ON the cover (no straddle below it). items-center
            keeps the logo vertically centered with the name + tagline. */}
        <div className="hidden sm:flex absolute inset-x-0 bottom-0 items-center gap-5 px-6 lg:px-12 pb-8 pointer-events-none">
          {hasLogo && (
            <div
              className={`shrink-0 w-[104px] h-[104px] lg:w-[116px] lg:h-[116px] rounded-[24px] flex items-center justify-center overflow-hidden border border-white/15 shadow-[0_10px_30px_rgba(0,0,0,0.5)] ${
                logoBg === "black" ? "bg-black" : "bg-white"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={restaurant.logoUrl} alt={restaurant.name} className="w-full h-full object-contain p-3" />
            </div>
          )}
          <div className="min-w-0">
            <h1
              className="text-[42px] lg:text-[54px] leading-[1.0] font-extrabold tracking-[-0.02em] text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.6)] truncate"
              style={nameFontStyle}
            >
              {restaurant.name}
            </h1>
            {tagline && (
              <p className="mt-2 text-[13px] lg:text-[14px] font-bold uppercase tracking-[0.12em] text-white/80 drop-shadow-[0_1px_6px_rgba(0,0,0,0.6)]">
                {tagline}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* WEB info row — single horizontal line below the cover, left-aligned:
          the order-type / fulfilment chip, then the info segments. pt clears
          the straddling logo above it. */}
      <div className="hidden sm:flex items-center flex-wrap gap-x-3 gap-y-2 bg-[var(--bg-page)] px-6 lg:px-12 pt-9 pb-5">
        {webOrderChip}
        {infoRow("justify-start")}
      </div>

      {/* MOBILE brand band — centered logo box + name + compact info line, on
          the page background so it blends into the menu. */}
      <div className="sm:hidden relative bg-[var(--bg-page)] px-5 pb-6 text-center">
        {hasLogo && (
          <div
            className={`relative mx-auto -mt-[52px] mb-3 w-[84px] h-[84px] rounded-[20px] flex items-center justify-center overflow-hidden border border-[var(--divider)] shadow-[0_8px_24px_rgba(0,0,0,0.30)] ${
              logoBg === "black" ? "bg-black" : "bg-white"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={restaurant.logoUrl} alt={restaurant.name} className="w-full h-full object-contain p-2.5" />
          </div>
        )}
        {tagline && (
          <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--text-soft)] mb-1.5">
            {tagline}
          </p>
        )}
        <h1
          className="text-[31px] leading-[1.04] font-extrabold tracking-[-0.02em] text-[var(--text)]"
          style={nameFontStyle}
        >
          {restaurant.name}
        </h1>
        {rowItems.length > 0 && <div className="mt-2.5">{infoRow("justify-center")}</div>}
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
