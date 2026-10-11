"use client";

import type { ReactNode } from "react";
import { ClockIcon, MapPinIcon } from "@heroicons/react/24/outline";
import { useI18n } from "@/lib/i18n";

/** Location and timing stay independently editable throughout cart and checkout. */
export function CommerceFulfillment({
  location,
  timing,
  onLocation,
  onTime,
  children,
}: {
  location: string;
  timing?: ReactNode;
  onLocation?: () => void;
  onTime?: () => void;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const locationContent = (
    <>
      <MapPinIcon aria-hidden="true" />
      <span>{location}</span>
    </>
  );
  const timeContent = (
    <>
      <ClockIcon aria-hidden="true" />
      <span>{timing}</span>
    </>
  );
  return (
    <section className="commerce-fulfillment commerce-section">
      <h2 className="commerce-section-title">{t("howToGetIt")}</h2>
      <div className="commerce-fulfillment-rows">
        {onLocation ? (
          <button
            type="button"
            onClick={onLocation}
            className="commerce-fulfillment-row"
            aria-label={`${t("edit")}: ${location}`}
          >
            {locationContent}
            <span className="commerce-row-edit">{t("edit")}</span>
          </button>
        ) : (
          <div className="commerce-fulfillment-row">{locationContent}</div>
        )}
        {timing &&
          (onTime ? (
            <button
              type="button"
              onClick={onTime}
              className="commerce-fulfillment-row"
            >
              {timeContent}
              <span className="commerce-row-edit">{t("edit")}</span>
            </button>
          ) : (
            <div className="commerce-fulfillment-row">{timeContent}</div>
          ))}
      </div>
      {children}
    </section>
  );
}
