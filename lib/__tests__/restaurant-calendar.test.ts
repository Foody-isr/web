import assert from 'node:assert/strict';
import test from 'node:test';
import { availabilityReasonText, checkRestaurantAvailability } from '../availability';

const originalDate = globalThis.Date;
test('calendar closures respect restaurant dates, service scope and inclusive boundaries', () => {
  class FixedDate extends Date { constructor(...args: any[]) { super(args.length ? args[0] : '2026-10-20T22:30:00Z'); } }
  globalThis.Date = FixedDate as DateConstructor;
  try {
    const restaurant = { timezone: 'Asia/Jerusalem', calendarClosures: [{ start_date: '2026-10-21', end_date: '2026-10-21', services: ['pickup' as const] }] };
    assert.deepEqual(checkRestaurantAvailability(restaurant, 'pickup'), { isOpen: false, reason: { kind: 'calendar_closure', endDate: '2026-10-21' } });
    assert.equal(checkRestaurantAvailability(restaurant, 'delivery').isOpen, true);
    assert.equal(checkRestaurantAvailability({ ...restaurant, timezone: 'Pacific/Honolulu' }, 'pickup').isOpen, true);
    assert.equal(checkRestaurantAvailability({ ...restaurant, batchFulfillmentEnabled: true }, 'pickup').isOpen, true);
    assert.equal(availabilityReasonText({ kind: 'calendar_closure', endDate: '2026-10-21' }, '', () => 'Fermé jusqu’au {date}'), 'Fermé jusqu’au 2026-10-21');
  } finally { globalThis.Date = originalDate; }
});
