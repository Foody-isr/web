import assert from 'node:assert/strict';
import test from 'node:test';
import { legacyOrderTimeline, orderTimeline, trackedOperationalStatus } from '../order-timeline';

for (const orderType of ['dine_in', 'pickup', 'delivery'] as const) {
  test(`${orderType}: payment cannot add or complete a preparation/handoff step`, () => {
    const result = legacyOrderTimeline({ orderType, status: 'in_kitchen' });
    assert.equal(result.steps[result.activeIndex]?.key, 'in_kitchen');
    assert.equal(result.steps.some(step => step.key === 'payment'), false);
    assert.ok(result.activeIndex < result.steps.length - 1);
  });
}

test('canonical pickup ready and picked-up statuses are recognized', () => {
  const ready = legacyOrderTimeline({ status: 'ready_for_pickup', orderType: 'pickup' });
  assert.equal(ready.steps[ready.activeIndex]?.key, 'ready');
  const pickedUp = legacyOrderTimeline({ status: 'picked_up', orderType: 'pickup' });
  assert.equal(pickedUp.steps[pickedUp.activeIndex]?.labelKey, 'statusPickedUp');
});

test('refund alone is unknown operational history, never cancelled or delivered', () => {
  const result = legacyOrderTimeline({ status: 'refunded', orderType: 'delivery' });
  assert.equal(result.activeIndex, -1);
  assert.equal(result.cancelled, false);
  assert.equal(result.unknown, true);
});

test('legacy received/served cannot become delivered by cross-type equivalence', () => {
  for (const status of ['received', 'served', 'picked_up'] as const) {
    const result = legacyOrderTimeline({ status, orderType: 'delivery' });
    assert.equal(result.activeIndex, -1);
    assert.equal(result.unknown, true);
  }
});

test('scheduled and approval steps do not disappear when the status advances', () => {
  for (const orderType of ['dine_in', 'pickup', 'delivery'] as const) {
    const accepted = legacyOrderTimeline({ status: 'accepted', orderType, scheduledFor: '2026-10-28' });
    const kitchen = legacyOrderTimeline({ status: 'in_kitchen', orderType, scheduledFor: '2026-10-28' });
    assert.deepEqual(accepted.steps, kitchen.steps);
    if (orderType !== 'dine_in') assert.equal(kitchen.steps[0].key, 'scheduled');
  }
});

function lifecycle(payment = 'paid', preparation = 'in_progress', handoff = 'unknown') {
  return {
    kind: 'available' as const,
    value: {
      schema_version: 1, scope: { kind: 'order', id: '7' }, identities: { order_ids: [7] },
      commercial: { state: 'closed', evidence: [] }, payment: { state: payment, evidence: [] },
      preparation: { state: preparation, evidence: [], quantities: { total: 2, not_sent: 0, held: 0, in_progress: 2, ready: 0, unknown: 0 } },
      handoff: { state: handoff, tracking: 'unknown', evidence: [] },
    },
  } as import('../order-lifecycle').OrderLifecycleRead;
}

test('all payment states leave the operational projection unchanged', () => {
  for (const payment of ['unpaid', 'pending', 'authorized', 'partially_paid', 'paid', 'refunded']) {
    const result = orderTimeline({ status: 'in_kitchen', orderType: 'dine_in', lifecycle: lifecycle(payment) });
    assert.deepEqual([...result.current], ['in_kitchen']);
    assert.equal(result.done.has('served'), false);
    assert.equal(result.done.has('ready'), false);
  }
});

test('known handoff survives refund while unknown preparation stays unknown', () => {
  const result = orderTimeline({ status: 'refunded', orderType: 'pickup', lifecycle: lifecycle('refunded', 'unknown', 'complete') });
  assert.equal(result.current.has('served'), true);
  assert.equal(result.done.has('in_kitchen'), false);
  assert.equal(result.done.has('ready'), false);
  assert.equal(result.unknown, true);
  assert.equal(trackedOperationalStatus('refunded', 'pickup', lifecycle('refunded', 'unknown', 'complete')), 'picked_up');
});

test('advertised failure never falls back to legacy delivered/paid progress', () => {
  const result = orderTimeline({ status: 'delivered', orderType: 'delivery', lifecycle: { kind: 'unavailable' } });
  assert.equal(result.done.size, 0);
  assert.equal(result.unknown, true);
  assert.equal(trackedOperationalStatus('delivered', 'delivery', { kind: 'unavailable' }), undefined);
});

test('not tracked omits the future handoff step; unknown keeps its distinction', () => {
  const notTracked = lifecycle('paid', 'ready');
  if (notTracked.kind !== 'available') throw new Error('fixture');
  notTracked.value.handoff.tracking = 'not_tracked';
  const result = orderTimeline({ status: 'ready', orderType: 'pickup', lifecycle: notTracked });
  assert.equal(result.steps.some(step => step.key === 'served'), false);
  assert.equal(result.message, 'orderHandoffNotTracked');
  const unknown = orderTimeline({ status: 'ready', orderType: 'pickup', lifecycle: lifecycle('paid', 'ready') });
  assert.equal(unknown.steps.some(step => step.key === 'served'), true);
});
