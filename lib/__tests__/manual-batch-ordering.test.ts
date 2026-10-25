import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchBatchFulfillmentConfig } from '@/services/api';
import { formatBatchStatusInline } from '@/components/ModeChip';

test('manual batch config preserves delivery dates without inventing a reopening time', async () => {
 const original = globalThis.fetch;
 globalThis.fetch = async () => Response.json({ enabled: true, ordering_mode: 'manual', ordering_open: true, current_batch_open_at: '', current_batch_cutoff: '', fulfillment_days: [{ date: '2026-10-30', day_name: 'Friday', delivery_window: { start: '08:00', end: '15:00' } }], upcoming_cycles: [], require_prepayment: true });
 try {
  const config = await fetchBatchFulfillmentConfig('1', 'delivery');
  assert.equal(config.orderingMode, 'manual');
  assert.equal(config.currentBatchOpenAt, '');
  assert.equal(config.fulfillmentDays[0].date, '2026-10-30');
  assert.deepEqual(config.fulfillmentDays[0].deliveryWindow, { start: '08:00', end: '15:00' });
  assert.match(formatBatchStatusInline(config, 'fr', 'Ouvre'), /30/);
  assert.doesNotMatch(formatBatchStatusInline({ ...config, orderingOpen: false }, 'fr', 'Ouvre'), /Ouvre|Invalid|1970/);
 } finally { globalThis.fetch = original; }
});
