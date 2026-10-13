"use client";

import { useQuery } from "@tanstack/react-query";
import { ClockIcon, MapPinIcon } from "@heroicons/react/24/outline";
import type { Restaurant } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { checkRestaurantAvailability, availabilityReasonText } from "@/lib/availability";
import { formatDateLabel } from "@/lib/scheduling";
import { formatLeadDuration, restaurantLeadMinutes } from "@/lib/fulfillment";
import { websiteOrderCopy } from "@/lib/websiteOrder";
import { fetchBatchFulfillmentConfig } from "@/services/api";

/** Summarizes the current pickup location and its server-owned collection windows. */
export function WebsitePickupSummary({ restaurant, open, onInfo }: {
  restaurant: Restaurant;
  open: boolean;
  onInfo: () => void;
}) {
  const { locale, t } = useI18n();
  const copy = websiteOrderCopy(locale);
  const batch = useQuery({
    queryKey: ["restaurant-header-batch", restaurant.id, "pickup"],
    queryFn: () => fetchBatchFulfillmentConfig(restaurant.id, "pickup"),
    enabled: open && !!restaurant.batchFulfillmentEnabled,
    staleTime: 30_000,
    retry: 1,
  });
  const availability = checkRestaurantAvailability(restaurant, "pickup");
  const leadMinutes = restaurantLeadMinutes(restaurant);
  const days = batch.data?.enabled ? batch.data.fulfillmentDays.filter(day => day.pickupWindow) : [];
  return (
    <div className="website-pickup-summary">
      <div className="website-pickup-detail">
        <MapPinIcon aria-hidden="true" />
        <div>
          <strong dir="auto">{restaurant.name}</strong>
          {restaurant.address && <p dir="auto">{restaurant.address}</p>}
          <div className="website-pickup-links">
            <button type="button" onClick={onInfo}>{copy.info}</button>
            {restaurant.address && <a
              href={`https://maps.google.com/?q=${encodeURIComponent(restaurant.address)}`}
              target="_blank" rel="noopener noreferrer"
            >{t("directions")}</a>}
          </div>
        </div>
      </div>
      <div className="website-pickup-detail website-pickup-timing">
        <ClockIcon aria-hidden="true" />
        <div>
          <strong>{copy.pickupWhen}</strong>
          {restaurant.batchFulfillmentEnabled ? batch.isError ? (
            <p role="alert">{copy.scheduleError} <button type="button" onClick={() => batch.refetch()}>{copy.retry}</button></p>
          ) : batch.isPending ? (
            <p role="status">{copy.loadingTimes}</p>
          ) : (
            <div role="status">
              <p>{t("preOrder")}</p>
              {days.length ? days.map(day => (
                <p key={day.date}>{formatDateLabel(day.date, locale)} · <bdi dir="ltr">{day.pickupWindow!.start} – {day.pickupWindow!.end}</bdi></p>
              )) : <p>{copy.noPickupTimes}</p>}
            </div>
          ) : (
            <p role="status">{restaurant.rushMode || restaurant.ordersPaused ? t("rushTitle")
              : restaurant.preordersOnly ? t("preOrder")
              : !availability.isOpen ? availabilityReasonText(availability.reason, copy.pickup, t) || t("closedTitle")
              : restaurant.schedulingEnabled && leadMinutes > 0 ? t("leadTimePreparation").replace("{duration}", formatLeadDuration(leadMinutes, t))
              : copy.asap}</p>
          )}
        </div>
      </div>
    </div>
  );
}
