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
    <main className="min-h-screen bg-light-surface" dir={direction}>
      {/* Hero/Cover Section */}
      <div className="relative h-48 sm:h-64 bg-gradient-to-br from-brand to-brand-dark">
        {restaurant.coverUrl && (
          <Image
            src={restaurant.coverUrl}
            alt={restaurant.name}
            fill
            className="object-cover opacity-80"
            priority
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        
        {/* Logo */}
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
          <div className="w-24 h-24 rounded-full bg-white shadow-xl border-4 border-white overflow-hidden flex items-center justify-center">
            {restaurant.logoUrl ? (
              <Image
                src={restaurant.logoUrl}
                alt={restaurant.name}
                width={96}
                height={96}
                className="object-cover w-full h-full"
              />
            ) : (
              <span className="text-4xl font-bold text-brand">
                {restaurant.name.charAt(0)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Restaurant Info */}
      <div className="pt-16 pb-8 px-6 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-ink">
          {restaurant.name}
        </h1>
        
        {restaurant.description && (
          <p className="mt-2 text-ink-muted max-w-md mx-auto">
            {restaurant.description}
          </p>
        )}

        {/* Info Pills */}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {restaurant.address && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-light-surface-2 text-sm text-ink-muted">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {restaurant.address}
            </span>
          )}
          
          {restaurant.openingHours && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-light-surface-2 text-sm text-ink-muted">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {restaurant.openingHours}
            </span>
          )}
          
          {restaurant.phone && (
            <a
              href={`tel:${restaurant.phone}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-light-surface-2 text-sm text-ink-muted hover:bg-brand/10 hover:text-brand transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              {restaurant.phone}
            </a>
          )}
        </div>
      </div>

      {/* Order Options */}
      {hasOrderOptions && (
        <div className="px-6 pb-12">
          <div className="max-w-md mx-auto space-y-4">
            <h2 className="text-center text-lg font-semibold text-ink mb-6">
              {t("howWouldYouLikeToOrder") || "How would you like to order?"}
            </h2>

            {restaurant.pickupEnabled && (
              <Link
                href={`/r/${restaurant.slug || restaurant.id}/pickup`}
                className="flex items-center gap-4 p-4 rounded-xl bg-white border border-light-divider shadow-sm hover:shadow-md hover:border-brand transition group"
              >
                <div className="w-14 h-14 rounded-full bg-brand/10 flex items-center justify-center group-hover:bg-brand/20 transition">
                  <svg className="w-7 h-7 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-ink group-hover:text-brand transition">
                    {t("pickup") || "Pickup"}
                  </div>
                  <div className="text-sm text-ink-muted">
                    {t("pickupDescription") || "Order now, pick up at the restaurant"}
                  </div>
                </div>
                <svg className="w-5 h-5 text-ink-muted group-hover:text-brand transition rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )}

            {restaurant.deliveryEnabled && (
              <Link
                href={`/r/${restaurant.slug || restaurant.id}/delivery`}
                className="flex items-center gap-4 p-4 rounded-xl bg-white border border-light-divider shadow-sm hover:shadow-md hover:border-brand transition group"
              >
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition">
                  <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-ink group-hover:text-green-600 transition">
                    {t("delivery") || "Delivery"}
                  </div>
                  <div className="text-sm text-ink-muted">
                    {t("deliveryDescription") || "We'll bring your order to you"}
                  </div>
                </div>
                <svg className="w-5 h-5 text-ink-muted group-hover:text-green-600 transition rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* If no order options (shouldn't happen but fallback) */}
      {!hasOrderOptions && (
        <div className="px-6 pb-12 text-center">
          <p className="text-ink-muted">
            {t("noOrderOptionsAvailable") || "Online ordering is not available at this time."}
          </p>
        </div>
      )}
    </main>
  );
}
