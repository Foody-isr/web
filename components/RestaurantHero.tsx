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
};

export function RestaurantHero({
  restaurant,
  orderType,
  onOpenOrderDetails,
  schedulingLabel,
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
      // Native share sheet when available — falls back to clipboard copy.
      // Mobile gets a real share menu; desktop gets a copy-toast.
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

  const OrderTypeIcon = () => {
    if (orderType === "delivery") {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <circle cx="6" cy="17" r="2" />
          <circle cx="18" cy="17" r="2" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M2 13h4l2-5h6l2 5h2l2 4M9 8l-2-2H4" />
        </svg>
      );
    }
    if (orderType === "pickup") {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 8l1-3h12l1 3M5 8h14v11a1 1 0 01-1 1H6a1 1 0 01-1-1V8zM9 12h6" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v18M9 3v6a2 2 0 01-2 2H5M14 3l-1 8h6l-1-8M16 11v10" />
      </svg>
    );
  };

  const tagline = websiteConfig?.tagline || restaurant.description;
  const useDefaultGradient = !restaurant.coverUrl && !restaurant.backgroundColor;

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

  // Order-type action button — interactive for pickup/delivery (opens the
  // OrderDetailsModal), static for dine-in (you can't change it via the QR
  // scan). Visual treatment is identical so the layout doesn't shift.
  const orderTypeInteractive = orderType !== "dine_in" && !!onOpenOrderDetails;

  return (
    <div className="relative" dir={direction}>
      {/* Hero cover — image only, no text overlay. The name and tagline live
          on the surface below where they can breathe and be the focal point. */}
      <div className="relative w-full h-[36vh] min-h-[240px] max-h-[360px]">
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

        {/* Soft top gradient — keeps the floating top-bar buttons legible
            when the cover image is bright. Light, doesn't fight the photo. */}
        <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-black/35 to-transparent pointer-events-none" />
      </div>

      {/* Restaurant info block — sits on the surface below the cover.
          Wolt-style: name first, stats inline, then a prominent action row. */}
      <div className="bg-[var(--surface)] px-5 sm:px-8 pt-5 pb-4">
        <div className={`flex items-start gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
          {restaurant.logoUrl && (
            <img
              src={restaurant.logoUrl}
              alt={restaurant.name}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover flex-shrink-0 -mt-10 sm:-mt-12 ring-4 ring-[var(--surface)] shadow-lg bg-[var(--surface)]"
            />
          )}
          <div className="flex-1 min-w-0">
            <h1
              className="text-2xl sm:text-3xl font-extrabold leading-tight tracking-tight text-[var(--text-primary)]"
              style={heroNameFont ? { fontFamily: `"${heroNameFont}", serif` } : undefined}
            >
              {restaurant.name}
            </h1>
            {tagline && (
              <p className="text-sm sm:text-[15px] text-[var(--text-soft)] mt-1 leading-snug">
                {tagline}
              </p>
            )}
          </div>
        </div>

        {/* Stats row — dot-separated, neutral text, single line that wraps on
            very narrow screens. Editorial cadence with thin separators. */}
        {stats.length > 0 && (
          <div className="mt-3 flex items-center gap-x-2 gap-y-1 flex-wrap text-[13px] text-[var(--text-soft)]">
            {stats.map((s, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="opacity-40 me-1">·</span>}
                <span className="opacity-70">{s.icon}</span>
                <span className="truncate max-w-[200px]">{s.label}</span>
              </span>
            ))}
          </div>
        )}

        {/* Action row — prominent rounded-rectangle order-type selector plus
            a circular share icon to match Wolt's pattern. The order-type
            button is the focal point of this row. */}
        <div className={`mt-4 flex items-stretch gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
          {orderTypeLabel && (
            <button
              onClick={orderTypeInteractive ? onOpenOrderDetails : undefined}
              disabled={!orderTypeInteractive}
              className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl bg-[var(--surface-subtle)] text-start transition ${
                orderTypeInteractive ? "active:scale-[0.99] hover:bg-[var(--divider)]" : "cursor-default"
              }`}
              aria-label={orderTypeLabel}
            >
              <span className="flex-shrink-0 text-brand">
                <OrderTypeIcon />
              </span>
              <span className="flex-1 min-w-0 flex items-baseline gap-1.5">
                <span className="font-bold text-[15px] text-[var(--text-primary)] truncate">
                  {orderTypeLabel}
                </span>
                {schedulingLabel ? (
                  <span className="text-[12.5px] text-amber-600 font-semibold truncate">
                    · {schedulingLabel}
                  </span>
                ) : orderType !== "dine_in" ? (
                  <span className="text-[12.5px] text-[var(--text-soft)] truncate">
                    · {getDeliveryTime()} {t("minutes") || "min"}
                  </span>
                ) : null}
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

          {/* Share — circular icon button matching the rounded-rectangle's
              visual weight. Native share sheet on mobile, clipboard fallback. */}
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
