import assert from 'node:assert/strict';
import test from 'node:test';
import { GET } from '../../app/api/ordering-test-ip/route';

test('Admin detects the same platform IP as ordering, with private responses and restricted CORS', async () => {
  const previous = process.env.VERCEL;
  process.env.VERCEL = '1';
  try {
    for (const origin of ['https://admin.foody-pos.co.il', 'https://dev-admin.foody-pos.co.il']) {
      const response = GET(new Request('https://app.foody-pos.co.il/api/ordering-test-ip', {
        headers: { origin, 'x-forwarded-for': '2001:db8::1', 'x-foody-test-client-ip': '203.0.113.99' },
      }));
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ip: '2001:db8::1' });
      assert.equal(response.headers.get('access-control-allow-origin'), origin);
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      assert.equal(response.headers.get('vary'), 'Origin');
      assert.equal(response.headers.get('access-control-allow-credentials'), null);
    }
    assert.equal(GET(new Request('https://app.foody-pos.co.il/api/ordering-test-ip', { headers: { origin: 'https://untrusted.example', 'x-forwarded-for': '203.0.113.10' } })).status, 403);
    const unavailableHeaders: Record<string, string>[] = [{}, { 'x-vercel-forwarded-for': '203.0.113.10' }, { 'x-forwarded-for': '203.0.113.10, 203.0.113.11' }];
    for (const headers of unavailableHeaders) {
      assert.equal(GET(new Request('https://app.foody-pos.co.il/api/ordering-test-ip', { headers })).status, 503);
    }
    delete process.env.VERCEL;
    assert.equal(GET(new Request('http://localhost/api/ordering-test-ip', { headers: { 'x-forwarded-for': '203.0.113.10' } })).status, 503);
  } finally {
    if (previous === undefined) delete process.env.VERCEL; else process.env.VERCEL = previous;
  }
});
