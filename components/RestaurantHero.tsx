"use client";

import { Restaurant, OrderType } from "@/lib/types";
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
}: Props) {
  const { t, direction } = useI18n();
  const websiteConfig = restaurant.websiteConfig;
  const isRTL = direction === "rtl";

  const heroNameFont = websiteConfig?.heroNameFont;
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
  const fulfilmentTime: { emoji: string; label: string } | null = (() => {
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
            {restaurant.logoUrl && (
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

          if (closingHourLabel) {
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
                  Always visible even when info pills overflow / are empty. */}
              <button
                onClick={onOpenInfo}
                className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/95 text-[var(--text-primary)] text-[12.5px] font-extrabold shadow-[0_4px_12px_rgba(0,0,0,0.18)] hover:bg-white active:scale-[0.97] transition ${
                  isRTL ? "me-auto" : "ms-auto"
                }`}
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

function GlassPill({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-white text-[11.5px] font-bold whitespace-nowrap"
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
