"use client";

import {
  ClockIcon,
  ChevronDownIcon,
  InformationCircleIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";

/** Compact service controls share real location, scheduling and information actions. */
export function WebsiteServiceBar({
  location,
  locationLabel,
  time,
  timeLabel,
  infoLabel,
  status,
  onLocation,
  onTime,
  onInfo,
  panels = false,
  preorder,
}: {
  location: string;
  locationLabel: string;
  time?: string;
  timeLabel?: string;
  infoLabel: string;
  status?: string;
  onLocation?: React.MouseEventHandler<HTMLButtonElement>;
  onTime?: React.MouseEventHandler<HTMLButtonElement>;
  onInfo?: () => void;
  panels?: boolean;
  preorder?: string;
}) {
  const locationContent = (
    <>
      <MapPinIcon aria-hidden="true" />
      <span className="website-service-location-text">
        <span>{location}</span>
        {status && <small role="status">{status}</small>}
      </span>
    </>
  );
  return (
    <div className="website-service-controls" data-panels={panels || undefined}>
      {onLocation ? (
        <button
          type="button"
          className="website-service-location"
          onClick={onLocation}
          aria-label={`${locationLabel}: ${location}`}
          title={location}
        >
          {locationContent}
          {panels && <ChevronDownIcon aria-hidden="true" />}
        </button>
      ) : (
        <div className="website-service-location" title={location}>
          {locationContent}
        </div>
      )}
      {time &&
        (onTime ? (
          <button
            type="button"
            className="website-service-time"
            onClick={onTime}
            aria-label={`${timeLabel}: ${time}`}
            title={time}
          >
            <ClockIcon aria-hidden="true" />
            <span>{time}</span>
            {panels && <ChevronDownIcon aria-hidden="true" />}
          </button>
        ) : (
          <div className="website-service-time" title={time}>
            <ClockIcon aria-hidden="true" />
            <span>{time}</span>
          </div>
        ))}
      {preorder && <span className="website-service-preorder">{preorder}</span>}
      {onInfo && <button
        type="button"
        className="website-service-info"
        onClick={onInfo}
        aria-label={infoLabel}
        title={infoLabel}
      >
        <InformationCircleIcon aria-hidden="true" />
      </button>}
    </div>
  );
}
