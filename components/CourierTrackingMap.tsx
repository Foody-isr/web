"use client";

import { useMemo, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { CourierTracking } from "../lib/types";

export interface CourierTrackingMapProps {
  tracking: CourierTracking;
  courierPhone?: string;
  /** Localized "arriving in ~{n} min" formatter; falls back to a default. */
  etaLabel?: (minutes: number) => string;
  className?: string;
}

function courierIcon(): L.DivIcon {
  return L.divIcon({
    className: "courier-pin",
    html: `<div style="width:20px;height:20px;border-radius:50%;background:var(--brand,#F18A47);border:3px solid #fff;box-shadow:0 0 0 5px color-mix(in srgb, var(--brand,#F18A47) 22%, transparent),0 2px 6px rgba(0,0,0,.4)"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function destIcon(): L.DivIcon {
  return L.divIcon({
    className: "dest-pin",
    html: `<div style="width:26px;height:26px;border-radius:8px 8px 8px 0;transform:rotate(-45deg);background:#e23744;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,.3)"><span style="transform:rotate(45deg);color:#fff;font-size:13px">🏠</span></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = points.map((p) => `${p[0]},${p[1]}`).join("|");
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

/**
 * CourierTrackingMap renders a live courier position on a Leaflet map, along
 * with a themed header showing the ETA, courier first name, and a call button.
 * Must be loaded via dynamic({ ssr: false }) — it imports Leaflet which is
 * browser-only.
 */
export default function CourierTrackingMap({
  tracking,
  courierPhone,
  etaLabel,
  className,
}: CourierTrackingMapProps) {
  const courier: [number, number] = [tracking.courierLat, tracking.courierLng];
  const dest: [number, number] | null =
    tracking.destLat != null && tracking.destLng != null
      ? [tracking.destLat, tracking.destLng]
      : null;

  const points = useMemo<[number, number][]>(
    () => (dest ? [courier, dest] : [courier]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tracking.courierLat, tracking.courierLng, tracking.destLat, tracking.destLng]
  );

  const minutes =
    tracking.etaSeconds != null
      ? Math.max(1, Math.round(tracking.etaSeconds / 60))
      : null;
  const eta =
    minutes != null
      ? etaLabel
        ? etaLabel(minutes)
        : `Arriving in ~${minutes} min`
      : null;

  const telHref = courierPhone
    ? `tel:${courierPhone.replace(/[^\d+]/g, "")}`
    : null;

  const initial = tracking.courierFirstName?.trim().charAt(0).toUpperCase();

  return (
    <div className={`card overflow-hidden${className ? ` ${className}` : ""}`}>
      {/* Header: courier info + ETA + call button — mirrors ConfirmationDeliveryCard */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          {/* Courier avatar + name / ETA */}
          <div className="flex items-center gap-3 min-w-0">
            {initial && (
              <div className="w-10 h-10 rounded-full bg-[var(--surface-subtle)] flex items-center justify-center text-sm font-bold text-brand shrink-0">
                {initial}
              </div>
            )}
            <div className="min-w-0">
              {tracking.courierFirstName && (
                <p className="text-sm font-medium text-[var(--text)] truncate">
                  {tracking.courierFirstName}
                </p>
              )}
              {eta && (
                <p className="text-xs text-[var(--text-muted)]">{eta}</p>
              )}
            </div>
          </div>

          {/* Call button */}
          {telHref && courierPhone && (
            <a
              href={telHref}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[var(--surface-subtle)] hover:bg-brand/10 transition text-sm shrink-0"
            >
              <span className="text-brand font-medium" dir="ltr">
                {courierPhone}
              </span>
            </a>
          )}
        </div>

        {/* ETA row (shown separately when no courier name present) */}
        {eta && !tracking.courierFirstName && (
          <div className="px-3 py-2.5 rounded-lg bg-[var(--surface-subtle)]">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">
              ETA
            </p>
            <p className="text-sm font-medium text-[var(--text)]">{eta}</p>
          </div>
        )}
      </div>

      {/* Leaflet map */}
      <div style={{ height: "240px" }}>
        <MapContainer
          center={courier}
          zoom={14}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={courier} icon={courierIcon()} />
          {dest && <Marker position={dest} icon={destIcon()} />}
          {dest && (
            <Polyline
              positions={[courier, dest]}
              pathOptions={{
                color: "var(--brand, #F18A47)",
                dashArray: "6 8",
                opacity: 0.7,
              }}
            />
          )}
          <FitBounds points={points} />
        </MapContainer>
      </div>
    </div>
  );
}
