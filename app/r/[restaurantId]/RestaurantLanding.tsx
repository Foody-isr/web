"use client";

import { Restaurant } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import Link from "next/link";
import Image from "next/image";

type Props = {
  restaurant: Restaurant;
};

export function RestaurantLanding({ restaurant }: Props) {
  const { t, direction } = useI18n();

  const hasOrderOptions = restaurant.pickupEnabled || restaurant.deliveryEnabled;

  return (
    <main className="min-h-screen bg-[var(--bg-page)]" dir={direction}>
      {/* Hero/Cover Section - Wolt Style */}
      <div className="relative h-64 sm:h-80 w-full">
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        
        {/* Restaurant Info - overlaid on hero */}
        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
          <div className="max-w-4xl mx-auto flex items-end gap-5">
            {/* Logo */}
            <div className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white shadow-2xl overflow-hidden border-4 border-white">
              {restaurant.logoUrl ? (
                <Image
                  src={restaurant.logoUrl}
                  alt={restaurant.name}
                  width={96}
                  height={96}
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-brand text-white text-3xl font-bold">
                  {restaurant.name.charAt(0)}
                </div>
              )}
            </div>

            {/* Restaurant name and description */}
            <div className="flex-1 min-w-0 mb-1">
              <h1 className="text-3xl sm:text-4xl font-bold text-white drop-shadow-lg">
                {restaurant.name}
              </h1>
              {restaurant.description && (
                <p className="text-base text-white/80 mt-1 line-clamp-2">
                  {restaurant.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Info Bar */}
      <div className="bg-[var(--surface)] border-b border-[var(--divider)]">
        <div className="max-w-4xl mx-auto flex items-center gap-3 px-6 py-4 overflow-x-auto scrollbar-hide">
          {/* Delivery time badge */}
          {restaurant.deliveryEnabled && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--surface-subtle)] text-sm font-medium whitespace-nowrap">
              <svg className="w-4 h-4 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
              </svg>
              <span>{t("delivery") || "Delivery"}</span>
              <span className="text-[var(--text-muted)]">25-35 min</span>
            </div>
          )}
          
          {/* Pickup time badge */}
          {restaurant.pickupEnabled && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--surface-subtle)] text-sm font-medium whitespace-nowrap">
              <svg className="w-4 h-4 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <span>{t("pickup") || "Pickup"}</span>
              <span className="text-[var(--text-muted)]">10-15 min</span>
            </div>
          )}

          {/* Opening hours */}
          {restaurant.openingHours && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--surface-subtle)] text-sm text-[var(--text-muted)] whitespace-nowrap">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{restaurant.openingHours}</span>
            </div>
          )}

          {/* Address */}
          {restaurant.address && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--surface-subtle)] text-sm text-[var(--text-muted)] whitespace-nowrap">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="truncate max-w-[200px]">{restaurant.address}</span>
            </div>
          )}

          {/* Phone */}
          {restaurant.phone && (
            <a
              href={`tel:${restaurant.phone}`}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--surface-subtle)] text-sm text-[var(--text-muted)] whitespace-nowrap hover:bg-brand/10 hover:text-brand transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span>{restaurant.phone}</span>
            </a>
          )}
        </div>
      </div>

      {/* Order Options - Wolt Style Cards */}
      {hasOrderOptions && (
        <div className="px-6 py-10 sm:py-16">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-center text-2xl sm:text-3xl font-bold mb-2">
              {t("howWouldYouLikeToOrder") || "How would you like to order?"}
            </h2>
            <p className="text-center text-[var(--text-muted)] mb-8">
              {t("chooseOrderType") || "Choose your preferred ordering method"}
            </p>

            <div className="space-y-4">
              {restaurant.pickupEnabled && (
                <Link
                  href={`/r/${restaurant.slug || restaurant.id}/pickup`}
                  className="flex items-center gap-5 p-5 rounded-2xl bg-[var(--surface)] border border-[var(--divider)] hover:border-brand hover:shadow-lg transition-all group"
                >
                  <div className="w-16 h-16 rounded-2xl bg-brand/10 flex items-center justify-center group-hover:bg-brand/20 transition">
                    <svg className="w-8 h-8 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-bold text-[var(--text)] group-hover:text-brand transition">
                        {t("pickup") || "Pickup"}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-[var(--surface-subtle)] text-sm text-[var(--text-muted)]">
                        10-15 min
                      </span>
                    </div>
                    <div className="text-sm text-[var(--text-muted)] mt-1">
                      {t("pickupDescription") || "Order now, pick up at the restaurant"}
                    </div>
                  </div>
                  <svg className="w-6 h-6 text-[var(--text-soft)] group-hover:text-brand transition rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              )}

              {restaurant.deliveryEnabled && (
                <Link
                  href={`/r/${restaurant.slug || restaurant.id}/delivery`}
                  className="flex items-center gap-5 p-5 rounded-2xl bg-[var(--surface)] border border-[var(--divider)] hover:border-accent-green hover:shadow-lg transition-all group"
                >
                  <div className="w-16 h-16 rounded-2xl bg-accent-green/10 flex items-center justify-center group-hover:bg-accent-green/20 transition">
                    <svg className="w-8 h-8 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-bold text-[var(--text)] group-hover:text-accent-green transition">
                        {t("delivery") || "Delivery"}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-[var(--surface-subtle)] text-sm text-[var(--text-muted)]">
                        25-35 min
                      </span>
                    </div>
                    <div className="text-sm text-[var(--text-muted)] mt-1">
                      {t("deliveryDescription") || "We'll bring your order to you"}
                    </div>
                  </div>
                  <svg className="w-6 h-6 text-[var(--text-soft)] group-hover:text-accent-green transition rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              )}
            </div>

            {/* Promotional Banner - Wolt Style */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="promo-banner">
                <div className="w-12 h-12 rounded-full bg-brand/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">🎉</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[var(--text)]">
                    {t("firstOrderDiscount") || "First order discount"}
                  </p>
                  <p className="text-sm text-[var(--text-muted)]">
                    {t("firstOrderDiscountDesc") || "Get 10% off your first order"}
                  </p>
                </div>
              </div>
              
              <div className="promo-banner">
                <div className="w-12 h-12 rounded-full bg-accent-green/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">🚚</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[var(--text)]">
                    {t("freeDelivery") || "Free delivery"}
                  </p>
                  <p className="text-sm text-[var(--text-muted)]">
                    {t("freeDeliveryDesc") || "On orders over ₪100"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* If no order options */}
      {!hasOrderOptions && (
        <div className="px-6 py-16 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-[var(--surface-subtle)] flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-[var(--text-soft)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-[var(--text-muted)] text-lg">
            {t("noOrderOptionsAvailable") || "Online ordering is not available at this time."}
          </p>
        </div>
      )}
    </main>
  );
}
