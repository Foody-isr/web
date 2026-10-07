"use client";

import {
  ClockIcon,
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
}: {
  location: string;
  locationLabel: string;
  time?: string;
  timeLabel?: string;
  infoLabel: string;
  status?: string;
  onLocation?: () => void;
  onTime?: () => void;
  onInfo: () => void;
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
    <div className="website-service-controls">
      {onLocation ? (
        <button
          type="button"
          className="website-service-location"
          onClick={onLocation}
          aria-label={`${locationLabel}: ${location}`}
          title={location}
        >
          {locationContent}
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
          </button>
        ) : (
          <div className="website-service-time" title={time}>
            <ClockIcon aria-hidden="true" />
            <span>{time}</span>
          </div>
        ))}
      <button
        type="button"
        className="website-service-info"
        onClick={onInfo}
        aria-label={infoLabel}
        title={infoLabel}
      >
        <InformationCircleIcon aria-hidden="true" />
      </button>
    </div>
  );
}
