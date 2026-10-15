import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import test from 'node:test';
import { orderingTestProxyHeaders } from '../server/ordering-test-proxy';
import { checkRestaurantAvailability, hasOrderingTestAccess } from '../availability';
import { resolveCustomerAPIPath } from '../customer-api-proxy';

test('only the platform IP is signed; ordinary or self-hosted headers cannot grant access', () => {
  const options = { secret: 'synthetic-secret'.repeat(4), vercel: true, now: 1800000000000 };
  const request = { method: 'POST', headers: new Headers({ 'x-vercel-forwarded-for': '203.0.113.10', 'x-forwarded-for': '203.0.113.99', 'x-foody-test-client-ip': '203.0.113.99' }) };
  const signed = orderingTestProxyHeaders(request, 'https://api.example/api/v1/public/orders?restaurant_id=1', '{}', options);
  assert.equal(signed.get('x-foody-test-client-ip'), '203.0.113.10');
  const digest = createHash('sha256').update('{}').digest('hex');
  assert.equal(signed.get('x-foody-test-signature'), createHmac('sha256', options.secret).update(['1800000000', '203.0.113.10', 'POST', '/api/v1/public/orders?restaurant_id=1', digest].join('\n')).digest('hex'));
  for (const headers of [new Headers({ 'x-forwarded-for': '203.0.113.10' }), new Headers({ 'x-vercel-forwarded-for': '203.0.113.10, 203.0.113.11' })]) {
    assert.equal([...orderingTestProxyHeaders({ method: 'GET', headers }, 'https://api.example/', '', options)].length, 0);
  }
  assert.equal([...orderingTestProxyHeaders(request, 'https://api.example/', '', { ...options, vercel: false })].length, 0);
  assert.equal([...orderingTestProxyHeaders(request, 'https://api.example/', '', { ...options, secret: '' })].length, 0);
});

test('temporary visitor access overrides a closure only before its exact expiry', () => {
  const expires = Date.now() + 60000;
  const restaurant = { calendarClosures: [{ id: 'test', start_date: '2000-01-01', end_date: '2099-01-01', services: ['pickup' as const] }], orderingTestAccessExpiresAt: new Date(expires).toISOString() };
  assert.equal(checkRestaurantAvailability(restaurant, 'pickup').isOpen, true);
  assert.equal(hasOrderingTestAccess(restaurant, expires), false);
  assert.equal(checkRestaurantAvailability({ ...restaurant, pickupEnabled: false }, 'pickup').isOpen, false);
  assert.equal(checkRestaurantAvailability({ ...restaurant, orderingTestAccessExpiresAt: undefined }, 'pickup').isOpen, false);
  assert.equal(hasOrderingTestAccess({ orderingTestAccessExpiresAt: 'invalid' }), false);
  assert.equal(resolveCustomerAPIPath('GET', ['restaurants', 'my-restaurant']), 'restaurants/my-restaurant');
  assert.equal(resolveCustomerAPIPath('GET', ['restaurants', '1', 'settings']), null);
});


test('the same staged artifact selects separate development and production signing keys', () => {
  const previousProd = process.env.ORDERING_TEST_PROXY_SECRET;
  const previousDev = process.env.ORDERING_TEST_PROXY_SECRET_DEV;
  try {
    process.env.ORDERING_TEST_PROXY_SECRET = 'production-synthetic-key'.repeat(3);
    process.env.ORDERING_TEST_PROXY_SECRET_DEV = 'development-synthetic-key'.repeat(3);
    const request = { method: 'GET', headers: new Headers({ 'x-vercel-forwarded-for': '203.0.113.10' }) };
    const options = { vercel: true, now: 1800000000000 };
    for (const [origin, secret] of [['https://dev-api.foody-pos.co.il', process.env.ORDERING_TEST_PROXY_SECRET_DEV], ['https://api.foody-pos.co.il', process.env.ORDERING_TEST_PROXY_SECRET]]) {
      const result = orderingTestProxyHeaders(request, origin + '/api/v1/public/restaurants/1', '', options);
      const digest = createHash('sha256').update('').digest('hex');
      const expected = createHmac('sha256', secret).update(['1800000000', '203.0.113.10', 'GET', '/api/v1/public/restaurants/1', digest].join('\n')).digest('hex');
      assert.equal(result.get('x-foody-test-signature'), expected);
    }
    delete process.env.ORDERING_TEST_PROXY_SECRET_DEV;
    assert.equal(Array.from(orderingTestProxyHeaders(request, 'https://dev-api.foody-pos.co.il/', '', options)).length, 0);
  } finally {
    if (previousProd === undefined) delete process.env.ORDERING_TEST_PROXY_SECRET; else process.env.ORDERING_TEST_PROXY_SECRET = previousProd;
    if (previousDev === undefined) delete process.env.ORDERING_TEST_PROXY_SECRET_DEV; else process.env.ORDERING_TEST_PROXY_SECRET_DEV = previousDev;
  }
});
