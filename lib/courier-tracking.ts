import type { CourierTracking } from './types';

function coordinate(value: unknown, limit: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;
}

/** Validate the shared HTTP/WebSocket tracking payload and optional road geometry. */
export function mapCourierTracking(value: unknown): CourierTracking | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (!coordinate(raw.courier_lat, 90) || !coordinate(raw.courier_lng, 180)) return null;
  const geometry: NonNullable<CourierTracking['routeGeometry']> = [];
  if (Array.isArray(raw.route_geometry)) for (const leg of raw.route_geometry) {
    if (!leg || !Array.isArray(leg.path) || !Number.isInteger(leg.order_id)) continue;
    if (leg.path.length < 2 || !leg.path.every((point: unknown) => Array.isArray(point) && point.length === 2 && coordinate(point[0], 90) && coordinate(point[1], 180))) continue;
    geometry.push({ order_id: leg.order_id, path: leg.path });
  }
  const provider = raw.routing_provider;
  return {
    courierFirstName: typeof raw.courier_first_name === 'string' ? raw.courier_first_name : undefined,
    courierLat: raw.courier_lat, courierLng: raw.courier_lng,
    destLat: coordinate(raw.dest_lat, 90) ? raw.dest_lat : undefined,
    destLng: coordinate(raw.dest_lng, 180) ? raw.dest_lng : undefined,
    etaSeconds: typeof raw.eta_seconds === 'number' && Number.isFinite(raw.eta_seconds) && raw.eta_seconds > 0 ? raw.eta_seconds : undefined,
    routingProvider: provider === 'google' || provider === 'geoapify' || provider === 'approximate' || provider === 'unavailable' ? provider : undefined,
    routeGeometry: geometry,
  };
}
