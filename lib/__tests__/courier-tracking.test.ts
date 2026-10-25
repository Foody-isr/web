import assert from 'node:assert/strict';
import test from 'node:test';
import { mapCourierTracking } from '../courier-tracking';

test('tracking uses the same validated road contract for HTTP and WebSocket', () => {
  const tracking = mapCourierTracking({ courier_lat: 32, courier_lng: 34, dest_lat: 32.1, dest_lng: 34.1, eta_seconds: 240, routing_provider: 'geoapify', route_geometry: [{ order_id: 7, path: [[32,34],[32,34.1],[32.1,34.1]] }] });
  assert.equal(tracking?.etaSeconds, 240);
  assert.equal(tracking?.routingProvider, 'geoapify');
  assert.deepEqual(tracking?.routeGeometry?.[0].path[1], [32,34.1]);
});

test('unavailable or invalid travel times never become a one-minute arrival', () => {
  for (const eta_seconds of [undefined, 0, -1, NaN, Infinity]) {
    const tracking = mapCourierTracking({ courier_lat: 32, courier_lng: 34, eta_seconds, routing_provider: 'unavailable' });
    assert.equal(tracking?.etaSeconds, undefined);
    assert.equal(tracking?.routingProvider, 'unavailable');
  }
});

test('invalid coordinates and road geometry are rejected', () => {
  assert.equal(mapCourierTracking({ courier_lat: Infinity, courier_lng: 34 }), null);
  const tracking = mapCourierTracking({ courier_lat: 32, courier_lng: 34, route_geometry: [{ order_id: 7, path: [[34,32],[100,34]] }] });
  assert.deepEqual(tracking?.routeGeometry, []);
});

test('Google tracking keeps provider provenance for matching map rendering', () => {
  const tracking = mapCourierTracking({ courier_lat: 32, courier_lng: 34, routing_provider: 'google', route_geometry: [{ order_id: 1, path: [[32, 34], [32.1, 34.1]] }] });
  assert.equal(tracking?.routingProvider, 'google');
  assert.equal(tracking?.routeGeometry?.length, 1);
});
