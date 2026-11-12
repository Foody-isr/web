"use client";

import { useRef, type ComponentPropsWithoutRef } from "react";
import {
  ClockIcon,
  ChevronDownIcon,
  InformationCircleIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";
import { usePublishHeight } from "@/lib/useStickyChrome";

/** Reserves space below the pinned service controls using their rendered height. */
export function WebsiteFulfillmentRegion({
  sticky,
  ...props
}: ComponentPropsWithoutRef<"div"> & { sticky: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  usePublishHeight(ref, "--website-fulfillment-sticky-height");

  return <div {...props} ref={sticky ? ref : undefined} data-fulfillment-sticky={sticky || undefined} />;
}

type ServiceSummary = { lead: string; detail?: string };

function ServiceValue({ text, compact }: { text: string; compact?: ServiceSummary }) {
  if (!compact) return <span>{text}</span>;
  return <>
    <span className="website-service-standard-value">{text}</span>
    <span className="website-service-compact-value">
      <strong>{compact.lead}</strong>{compact.detail && <> — <bdi>{compact.detail}</bdi></>}
    </span>
  </>;
}

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
  compactSummary,
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
  compactSummary?: { location: ServiceSummary; time?: ServiceSummary };
}) {
  const compactLocation = compactSummary?.location;
  const fullLocation = compactLocation
    ? [compactLocation.lead, compactLocation.detail].filter(Boolean).join(" — ")
    : location;
  const locationContent = (
    <>
      <MapPinIcon aria-hidden="true" />
      <span className="website-service-location-text">
        <ServiceValue text={location} compact={compactLocation} />
        {status && <small role="status">{status}</small>}
      </span>
    </>
  );
  const locationControl = onLocation ? (
    <button type="button" className="website-service-location" onClick={onLocation}
      aria-label={`${locationLabel}: ${fullLocation}`} title={fullLocation}>
      {locationContent}
      {panels && <ChevronDownIcon aria-hidden="true" />}
    </button>
  ) : <div className="website-service-location" title={fullLocation}>{locationContent}</div>;
  const timeContent = time && <>
    <ClockIcon aria-hidden="true" />
    <ServiceValue text={time} compact={compactSummary?.time} />
  </>;
  const timeControl = time && (onTime ? (
    <button type="button" className="website-service-time" onClick={onTime}
      aria-label={`${timeLabel}: ${time}`} title={time}>
      {timeContent}
      {panels && <ChevronDownIcon aria-hidden="true" />}
    </button>
  ) : <div className="website-service-time" title={time}>{timeContent}</div>);
  return (
    <div className="website-service-controls" data-panels={panels || undefined}>
      {compactSummary ? <>{timeControl}{locationControl}</> : <>{locationControl}{timeControl}</>}
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
