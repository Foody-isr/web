"use client";

import { Restaurant, OrderType } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import Image from "next/image";
import Link from "next/link";

type Props = {
  restaurant: Restaurant;
  orderType?: OrderType;
  tableId?: string;
  showBackLink?: boolean;
  compact?: boolean;
  canSwitchOrderType?: boolean;
  onOrderTypeChange?: (type: OrderType) => void;
};

export function RestaurantHero({
  restaurant,
  orderType,
  tableId,
  showBackLink = true,
  compact = false,
  canSwitchOrderType = false,
  onOrderTypeChange,
}: Props) {
  const { t, direction } = useI18n();

  const getDeliveryTime = () => {
    // This could come from restaurant settings in the future
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

  return (
    <div className="relative" dir={direction}>
      {/* Hero Cover Image */}
      <div className={`relative w-full ${compact ? "h-40 sm:h-48" : "h-56 sm:h-72"}`}>
        {restaurant.coverUrl ? (
          <Image
            src={restaurant.coverUrl}
            alt={restaurant.name}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-brand to-brand-dark" />
        )}
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        {/* Restaurant Info - overlaid on hero */}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
          <div className="flex items-end gap-4">
            {/* Logo */}
            <div className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-white shadow-xl overflow-hidden border-2 border-white">
              {restaurant.logoUrl ? (
                <Image
                  src={restaurant.logoUrl}
                  alt={restaurant.name}
                  width={80}
                  height={80}
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-brand text-white text-2xl font-bold">
                  {restaurant.name.charAt(0)}
                </div>
              )}
            </div>

            {/* Restaurant name and description */}
            <div className="flex-1 min-w-0 mb-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-white truncate">
                {restaurant.name}
              </h1>
              {restaurant.description && (
                <p className="text-sm text-white/80 mt-0.5 line-clamp-1">
                  {restaurant.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Info Bar - Wolt style */}
      <div className="bg-[var(--surface)] border-b border-[var(--divider)]">
        <div className="flex items-center gap-3 px-4 sm:px-6 py-3 overflow-x-auto scrollbar-hide">
          {/* Order type switcher or badge */}
          {orderType && canSwitchOrderType && onOrderTypeChange ? (
            <div className="flex items-center rounded-full bg-[var(--surface-subtle)] p-1">
              <button
                onClick={() => onOrderTypeChange("pickup")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
                  orderType === "pickup"
                    ? "bg-brand text-white shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <span>{t("pickup") || "Pickup"}</span>
              </button>
              <button
                onClick={() => onOrderTypeChange("delivery")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
                  orderType === "delivery"
                    ? "bg-accent-green text-white shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                </svg>
                <span>{t("delivery") || "Delivery"}</span>
              </button>
            </div>
          ) : orderType && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--surface-subtle)] text-sm font-medium whitespace-nowrap">
              {orderType === "delivery" && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                </svg>
              )}
              {orderType === "pickup" && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              )}
              {orderType === "dine_in" && (
                <span className="text-base">🍽️</span>
              )}
              <span>{orderTypeLabel}</span>
              <span className="text-[var(--text-muted)]">·</span>
              <span className="text-[var(--text-muted)]">{getDeliveryTime()} {t("minutes") || "min"}</span>
            </div>
          )}

          {/* Table info for dine-in */}
          {tableId && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand/10 text-brand text-sm font-medium whitespace-nowrap">
              <span>🪑</span>
              <span>{t("table") || "Table"} {tableId}</span>
            </div>
          )}

          {/* Opening hours */}
          {restaurant.openingHours && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface-subtle)] text-sm text-[var(--text-muted)] whitespace-nowrap">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{restaurant.openingHours}</span>
            </div>
          )}

          {/* Address */}
          {restaurant.address && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface-subtle)] text-sm text-[var(--text-muted)] whitespace-nowrap">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="truncate max-w-[200px]">{restaurant.address}</span>
            </div>
          )}

          {/* Phone (clickable) */}
          {restaurant.phone && (
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
