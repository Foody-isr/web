import assert from 'node:assert/strict';
import test from 'node:test';
import { isCurrentOrderEvent, orderCollectionAllowed } from '../order-tracking';

test('both order and payment events invalidate the current order snapshot', () => {
  for (const type of ['order.updated', 'order.ready', 'payment.completed']) {
    assert.equal(isCurrentOrderEvent({ type, order_id: 7, restaurant_id: 19, payload: { id: 7 } }, '7', '19'), true);
  }
  assert.equal(isCurrentOrderEvent({ payload: { status: 'in_kitchen' } }, '7', '19'), true);
});

test('sibling QR orders and other restaurant events cannot update this order', () => {
  for (const message of [
    { type: 'order.updated', order_id: 8 },
    { type: 'payment.completed', order_id: 7, restaurant_id: 20 },
    { type: 'order.updated', order_id: 7, payload: { id: 8 } },
    { type: 'courier.location', order_id: 7 },
    { type: 'table.order.updated', payload: { session_id: 'same-table' } },
    null, 'paid', { payload: null },
  ]) assert.equal(isCurrentOrderEvent(message, '7', '19'), false);
});


test('v1 expected payment retains eligibility while authorization and unknown facts grant no collection', () => {
  for (const state of ['authorized', 'paid', 'refunded', 'mixed', 'unknown']) {
    assert.equal(orderCollectionAllowed({ kind: 'available', value: { payment: { state } } } as any), false);
  }
  for (const state of ['unpaid', 'pending', 'partially_paid']) {
    assert.equal(orderCollectionAllowed({ kind: 'available', value: { payment: { state } } } as any), true);
  }
  assert.equal(orderCollectionAllowed({ kind: 'unavailable' }), false);
  assert.equal(orderCollectionAllowed({ kind: 'legacy' }), true);
});
