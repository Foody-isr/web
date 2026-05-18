"use client";

import { Restaurant, OrderType } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { ensureFont } from "@/components/sections/typography";
import { currencySymbol } from "@/lib/constants";
import Image from "next/image";
import { useEffect, useState } from "react";

// Defensive clamp — server already clamps on write, but stale or hand-edited
// API responses could still slip through. Two layers, both cheap.
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
  /** If provided, the order-type chip becomes a button that opens the Order Details modal. */
  onOpenOrderDetails?: () => void;
  /** Scheduling label shown next to the order type (e.g. "Today · 12:00 – 12:30"). */
  schedulingLabel?: string;
  /** Table label shown inside the order-type button when in dine-in mode (e.g. "Table 1"). */
  tableLabel?: string;
};

export function RestaurantHero({
  restaurant,
  orderType,
  compact = false,
  onOpenOrderDetails,
  schedulingLabel,
  tableLabel,
}: Props) {
  const { t, direction } = useI18n();
  const websiteConfig = restaurant.websiteConfig;
  const isRTL = direction === "rtl";

  const heroNameFont = websiteConfig?.heroNameFont;
  useEffect(() => {
    ensureFont(heroNameFont);
  }, [heroNameFont]);

  const [copied, setCopied] = useState(false);
  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: restaurant.name, url });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }
    } catch {
      // User cancelled — no-op.
    }
  };

  const getDeliveryTime = () => (orderType === "delivery" ? "25-35" : "10-15");

  const orderTypeLabel = (() => {
    switch (orderType) {
      case "delivery":
        return t("delivery") || "Delivery";
      case "pickup":
        return t("pickup") || "Pickup";
      case "dine_in":
        return t("dineIn") || "Dine In";
      default:
        return null;
    }
  })();

  const tagline = websiteConfig?.tagline || restaurant.description;
  const useDefaultGradient = !restaurant.coverUrl && !restaurant.backgroundColor;

  // Hero height — full cover dominance, scales gracefully on desktop.
  const heroHeightClass = compact
    ? "h-[44vh] min-h-[300px] max-h-[440px]"
    : "h-[60vh] sm:h-[64vh] lg:h-[68vh] min-h-[380px] max-h-[640px]";

  // Stats — only render what we actually have, with editorial dot separators.
  const stats: Array<{ icon: React.ReactNode; label: string }> = [];
  if (restaurant.openingHours && websiteConfig?.showHours !== false) {
    stats.push({
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
        </svg>
      ),
      label: restaurant.openingHours,
    });
  }
  if (restaurant.minimumOrderDelivery && restaurant.minimumOrderDelivery > 0 && orderType === "delivery") {
    stats.push({
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 12h18M3 17h12" />
        </svg>
      ),
      label: `${t("minimumOrderInfo") || "Min."} ${currencySymbol("ILS")}${restaurant.minimumOrderDelivery.toFixed(2)}`,
    });
  }
  if (restaurant.address && websiteConfig?.showAddress !== false) {
    stats.push({
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <circle cx="12" cy="11" r="3" />
        </svg>
      ),
      label: restaurant.address,
    });
  }

  // Order-type button is interactive for pickup/delivery (opens the
  // OrderDetailsModal), static-display for dine-in (you can't change it via
  // the QR scan). Visual treatment is identical so the layout doesn't shift.
  const orderTypeInteractive = orderType !== "dine_in" && !!onOpenOrderDetails;

  // Secondary line inside the order-type button.
  //   • dine-in:   table label (e.g. "Table 1") when present
  //   • scheduled: scheduling label in amber
  //   • else:      delivery/pickup ETA
  const orderTypeSecondary: { label: string; tone: "soft" | "amber" } | null = (() => {
    if (orderType === "dine_in" && tableLabel) {
      return { label: tableLabel, tone: "soft" };
    }
    if (schedulingLabel) {
      return { label: schedulingLabel, tone: "amber" };
    }
    if (orderType && orderType !== "dine_in") {
      return { label: `${getDeliveryTime()} ${t("minutes") || "min"}`, tone: "soft" };
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

        {/* Legibility gradient — bottom-anchored so the name overlay reads
            clearly against bright covers. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

        {/* Soft top gradient under the floating TopBar buttons */}
        <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-black/35 to-transparent pointer-events-none" />

        {/* Restaurant name overlay — RTL-aware, with bottom padding sized to
            clear the wave divider that follows. */}
        <div
          className={`absolute bottom-0 inset-x-0 px-5 sm:px-8 lg:px-12 pb-16 sm:pb-20 lg:pb-24 ${
            isRTL ? "text-right" : "text-left"
          }`}
        >
          <div className={`max-w-3xl flex flex-col ${isRTL ? "items-end" : "items-start"}`}>
            {restaurant.logoUrl && (
              <img
                src={restaurant.logoUrl}
                alt={restaurant.name}
                className="sm:hidden h-14 w-auto mb-3 drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]"
              />
            )}
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)]"
              style={heroNameFont ? { fontFamily: `"${heroNameFont}", serif` } : undefined}
            >
              {restaurant.name}
            </h1>
            {tagline && (
              <p className="text-base sm:text-lg lg:text-xl text-white/85 mt-2 sm:mt-3 max-w-xl drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">
                {tagline}
              </p>
            )}
          </div>
        </div>

        {/* Wave divider — Wolt-style fabric curve that gently transitions the
            cover image into the content surface below. The SVG fills the
            bottom portion with the surface color, leaving a smooth concave
            edge on the cover. */}
        <div className="absolute bottom-0 inset-x-0 pointer-events-none translate-y-px">
          <svg
            viewBox="0 0 1440 56"
            preserveAspectRatio="none"
            className="block w-full h-10 sm:h-12"
            aria-hidden
          >
            <path
              d="M0,0 C360,56 1080,56 1440,0 L1440,56 L0,56 Z"
              fill="var(--surface)"
            />
          </svg>
        </div>
      </div>

      {/* Info block — sits on the surface below the cover. Stats and the
          action row only; the name lives on the hero. */}
      <div className="bg-[var(--surface)] px-5 sm:px-8 pt-3 pb-4">
        {/* Stats row */}
        {stats.length > 0 && (
          <div className="flex items-center gap-x-2 gap-y-1 flex-wrap text-[13px] text-[var(--text-soft)]">
            {stats.map((s, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="opacity-40 me-1">·</span>}
                <span className="opacity-70">{s.icon}</span>
                <span className="truncate max-w-[220px]">{s.label}</span>
              </span>
            ))}
          </div>
        )}

        {/* Action row — prominent rounded-rectangle order-type selector
            plus a circular share icon. No icon inside the button anymore,
            and dine-in mode surfaces the table label inline. */}
        <div className={`mt-3 flex items-stretch gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
          {orderTypeLabel && (
            <button
              onClick={orderTypeInteractive ? onOpenOrderDetails : undefined}
              disabled={!orderTypeInteractive}
              className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl bg-[var(--surface-subtle)] text-start transition ${
                orderTypeInteractive ? "active:scale-[0.99] hover:bg-[var(--divider)]" : "cursor-default"
              }`}
              aria-label={orderTypeLabel}
            >
              <span className="flex-1 min-w-0 flex items-baseline gap-1.5">
                <span className="font-bold text-[15px] text-[var(--text-primary)] truncate">
                  {orderTypeLabel}
                </span>
                {orderTypeSecondary && (
                  <span
                    className={`text-[12.5px] truncate font-semibold ${
                      orderTypeSecondary.tone === "amber"
                        ? "text-amber-600"
                        : "text-[var(--text-soft)]"
                    }`}
                  >
                    · {orderTypeSecondary.label}
                  </span>
                )}
              </span>
              {orderTypeInteractive && (
                <svg
                  className="w-4 h-4 text-[var(--text-soft)] flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.4}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>
          )}

          {/* Share */}
          <button
            onClick={handleShare}
            className="relative w-12 h-12 rounded-2xl bg-[var(--surface-subtle)] hover:bg-[var(--divider)] flex items-center justify-center flex-shrink-0 transition active:scale-[0.96]"
            aria-label={t("share") || "Share"}
            title={t("share") || "Share"}
          >
            <svg
              className="w-5 h-5 text-brand"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
            </svg>
            {copied && (
              <span className="absolute -top-2 -end-2 px-1.5 py-0.5 rounded-full bg-brand text-white text-[10px] font-bold animate-in fade-in zoom-in">
                ✓
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Soft divider — separates the info block from the menu below */}
      <div className="h-px bg-[var(--divider)]" />
    </div>
  );
}
