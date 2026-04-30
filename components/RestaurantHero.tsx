"use client";

import { Restaurant, OrderType } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { ensureFont } from "@/components/sections/typography";
import Image from "next/image";
import { useEffect } from "react";

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
  compact = false,
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

  const getDeliveryTime = () => {
    return orderType === "delivery" ? "25-35" : "10-15";
  };

  const getOrderTypeLabel = () => {
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
  };

  const orderTypeLabel = getOrderTypeLabel();

  // Heights: full-bleed hero, capped so it never dominates large screens
  const heroHeightClass = compact
    ? "h-[40vh] min-h-[280px] max-h-[400px]"
    : "h-[55vh] sm:h-[60vh] lg:h-[65vh] min-h-[360px] max-h-[600px]";

  const tagline = websiteConfig?.tagline || restaurant.description;
  const useDefaultGradient = !restaurant.coverUrl && !restaurant.backgroundColor;

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
              priority
            />
          )
        ) : useDefaultGradient ? (
          <div className="absolute inset-0 bg-gradient-to-br from-brand to-brand-dark" />
        ) : (
          <div className="absolute inset-0" style={{ backgroundColor: restaurant.backgroundColor || undefined }} />
        )}

        {/* Legibility gradient — bottom-anchored so the name overlay stays readable */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent pointer-events-none" />

        {/* Name overlay — bottom-aligned, RTL-aware */}
        <div
          className={`absolute bottom-0 inset-x-0 px-5 sm:px-8 lg:px-12 pb-6 sm:pb-8 lg:pb-12 ${
            isRTL ? "text-right" : "text-left"
          }`}
        >
          <div className="max-w-3xl">
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
      </div>

      {/* Info Bar — order type, hours, address, phone */}
      <div className="bg-[var(--surface)] border-b border-[var(--divider)]">
        <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 overflow-x-auto scrollbar-hide justify-center sm:justify-start flex-wrap sm:flex-nowrap">
          {orderType && orderType !== "dine_in" && onOpenOrderDetails ? (
            <button
              onClick={onOpenOrderDetails}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--surface-subtle)] text-sm font-semibold whitespace-nowrap hover:bg-[var(--divider)] transition"
            >
              {orderType === "delivery" ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              )}
              <span>{orderTypeLabel}</span>
              <span className="text-[var(--text-muted)] font-normal">·</span>
              {schedulingLabel ? (
                <span className="text-amber-600 font-medium">{schedulingLabel}</span>
              ) : (
                <span className="text-[var(--text-muted)] font-normal">{getDeliveryTime()} {t("minutes") || "min"}</span>
              )}
              <svg className="w-3.5 h-3.5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          ) : orderType && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--surface-subtle)] text-sm font-medium whitespace-nowrap">
              {orderType === "dine_in" && <span className="text-base">🍽️</span>}
              <span>{orderTypeLabel}</span>
            </div>
          )}

          {restaurant.openingHours && (websiteConfig?.showHours !== false) && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface-subtle)] text-sm text-[var(--text-muted)] whitespace-nowrap">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{restaurant.openingHours}</span>
            </div>
          )}

          {restaurant.address && (websiteConfig?.showAddress !== false) && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface-subtle)] text-sm text-[var(--text-muted)] whitespace-nowrap">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="truncate max-w-[200px]">{restaurant.address}</span>
            </div>
          )}

          {restaurant.phone && (websiteConfig?.showPhone !== false) && (
            <a
              href={`tel:${restaurant.phone}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface-subtle)] text-sm text-[var(--text-muted)] whitespace-nowrap hover:bg-brand/10 hover:text-brand transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span>{restaurant.phone}</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
