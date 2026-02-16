"use client";

import { Restaurant, OrderType } from "@/lib/types";
import { checkAvailability } from "@/lib/availability";

interface AvailabilityBannerProps {
  restaurant: Restaurant;
  serviceType: OrderType;
}

export function AvailabilityBanner({
  restaurant,
  serviceType,
}: AvailabilityBannerProps) {
  // Rush mode takes priority
  if (restaurant.rushMode) {
    return (
      <div className="mx-4 mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
        <div className="text-3xl mb-2">⏸️</div>
        <h3 className="font-bold text-amber-800 text-lg">Temporarily Paused</h3>
        <p className="text-sm text-amber-600 mt-1">
          {restaurant.name} is not accepting new orders right now.
        </p>
        <p className="text-xs text-amber-500 mt-3">
          Please check back shortly.
        </p>
      </div>
    );
  }

  const status = checkAvailability(
    restaurant.openingHoursConfig,
    serviceType,
    restaurant.timezone || "UTC"
  );

  if (status.isOpen) {
    return null; // Don't show banner if open
  }

  // Format service type for display
  const serviceTypeDisplay =
    serviceType === "dine_in"
      ? "dine-in"
      : serviceType === "pickup"
      ? "pickup"
      : "delivery";

  return (
    <div className="mx-4 mt-4 rounded-2xl border border-red-200 bg-red-50 p-5 text-center">
      <div className="text-3xl mb-2">🔒</div>
      <h3 className="font-bold text-red-800 text-lg">Currently Closed</h3>
      <p className="text-sm text-red-600 mt-1">
        {restaurant.name} is currently closed for {serviceTypeDisplay}.
      </p>
      {status.message && (
        <p className="text-sm text-red-600 mt-1">{status.message}</p>
      )}
      <p className="text-xs text-red-500 mt-3">
        Please check back during operating hours to place your order.
      </p>
    </div>
  );
}
