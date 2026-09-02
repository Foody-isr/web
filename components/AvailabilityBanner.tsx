"use client";

import { Restaurant, OrderType } from "@/lib/types";
import {
  availabilityReasonText,
  checkRestaurantAvailability,
} from "@/lib/availability";
import { useI18n } from "@/lib/i18n";

interface AvailabilityBannerProps {
  restaurant: Restaurant;
  serviceType: OrderType;
}

export function AvailabilityBanner({
  restaurant,
  serviceType,
}: AvailabilityBannerProps) {
  const { t } = useI18n();

  // A paused storefront (rush mode or the one-click pause) takes priority
  if (restaurant.rushMode || restaurant.ordersPaused) {
    return (
      <div className="mx-4 mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
        <div className="text-3xl mb-2">⏸️</div>
        <h3 className="font-bold text-amber-800 text-lg">{t("rushTitle")}</h3>
        <p className="text-sm text-amber-600 mt-1">
          {t("rushMessage").replace("{name}", restaurant.name)}
        </p>
        <p className="text-xs text-amber-500 mt-3">{t("rushSubtext")}</p>
      </div>
    );
  }

  const status = checkRestaurantAvailability(restaurant, serviceType);

  if (status.isOpen) {
    return null; // Don't show banner if open
  }

  // Format service type for display
  const serviceTypeDisplay =
    serviceType === "dine_in"
      ? t("dineIn")
      : serviceType === "pickup"
      ? t("pickup")
      : t("delivery");

  const reasonText = availabilityReasonText(
    status.reason,
    serviceTypeDisplay,
    t
  );

  return (
    <div className="mx-4 mt-4 rounded-2xl border border-red-200 bg-red-50 p-5 text-center">
      <div className="text-3xl mb-2">🔒</div>
      <h3 className="font-bold text-red-800 text-lg">{t("closedTitle")}</h3>
      <p className="text-sm text-red-600 mt-1">
        {t("closedMessage")
          .replace("{name}", restaurant.name)
          .replace("{service}", serviceTypeDisplay)}
      </p>
      {reasonText && <p className="text-sm text-red-600 mt-1">{reasonText}</p>}
      <p className="text-xs text-red-500 mt-3">{t("closedSubtext")}</p>
    </div>
  );
}
