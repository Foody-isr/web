import assert from 'node:assert/strict';
import test from 'node:test';
import { createOrder, createCateringQuote } from '@/services/api';
import type { OrderPayload } from '@/lib/types';

test('order and catering API clients reject invalid contacts without a request', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('unexpected request'); };
  try {
    for (const phone of ['', '050', 'call 0502345678']) {
      await assert.rejects(createOrder({ restaurantId: '1', orderType: 'pickup', customerPhone: phone, paymentMethod: 'pay_later', items: [] }), /invalid_customer_phone/);
      await assert.rejects(createCateringQuote({ restaurantId: 1, serviceId: 2, customerName: 'Client exemple', customerPhone: phone, guests: 2, items: [], choices: [], optionIds: [] }), /invalid_customer_phone/);
    }
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});

test('order contact and delivery metadata are canonical before the request; table phone is optional', async () => {
  const original = globalThis.fetch;
  const bodies: Record<string, unknown>[] = [];
  globalThis.fetch = async (_url, options) => {
    bodies.push(JSON.parse(String(options?.body)));
    return Response.json({ order: { id: 12, total_amount: 20, status: 'received' } });
  };
  const payload: OrderPayload = { restaurantId: '1', orderType: 'delivery', customerPhone: '050-234-5678', deliveryAddress: 'Adresse exemple', paymentMethod: 'pay_later', items: [] };
  try {
    await createOrder(payload);
    assert.equal(bodies[0].customer_phone, '+972502345678');
    assert.equal((bodies[0].external_metadata as Record<string, unknown>).customer_phone, '+972502345678');
    await createOrder({ ...payload, orderType: 'dine_in', customerPhone: '' });
    assert.equal(bodies[1].customer_phone, '');
    await assert.rejects(createOrder({ ...payload, orderType: 'dine_in', customerPhone: '050' }), /invalid_customer_phone/);
    assert.equal(bodies.length, 2);
  } finally { globalThis.fetch = original; }
});
