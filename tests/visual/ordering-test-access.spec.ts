import { createServer, type Server } from 'node:http';
import { createHash, createHmac } from 'node:crypto';
import { expect, test } from '@playwright/test';

const secret = 'synthetic-test-access-secret-for-local-browser-only';
let api: Server, expiry: string, signedIPs: string[];
const sourcePage = {
  id: 1, restaurant_id: 9001, slug: 'order', title: 'Menu', type: 'order',
  sort_order: 0, nav_visible: true, is_default: true, is_homepage: true,
  seo: {}, sections: [], settings: { menu_ids: [1] },
  appearance_overrides: { foody_renderer_version: 1, website_order: { layout: 'rows', show_fulfillment: false, prompt_on_entry: false } },
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
};

test.beforeAll(async () => {
  api = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks).toString();
    const ip = String(request.headers['x-foody-test-client-ip'] ?? '');
    const stamp = String(request.headers['x-foody-test-timestamp'] ?? '');
    const digest = createHash('sha256').update(body).digest('hex');
    const signature = createHmac('sha256', secret).update([stamp, ip, request.method, request.url, digest].join('\n')).digest('hex');
    const signed = signature === request.headers['x-foody-test-signature'];
    if (signed) signedIPs.push(ip);
    const allowed = signed && ip === '203.0.113.10' && Date.parse(expiry) > Date.now();
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Headers', 'content-type');
    const path = new URL(request.url!, 'http://127.0.0.1:43220').pathname;
    let result: unknown = {};
    if (/\/restaurants\/(9001|synthetic)$/.test(path)) result = { restaurant: {
      id: 9001, slug: 'synthetic', name: 'Synthetic closed bakery', currency: 'ILS', timezone: 'Asia/Jerusalem',
      pickup_enabled: true, delivery_enabled: false, orders_paused: true, rush_mode: false,
      ordering_test_access_expires_at: allowed ? expiry : null,
      website_config: { checkout_config: { lock_order_type: true } },
    } };
    else if (path.endsWith('/website-pages')) result = { pages: [sourcePage] };
    else if (path.includes('/website-pages/')) result = { page: sourcePage };
    else if (path.endsWith('/menu')) result = { currency: 'ILS', menus: [{ id: 1, name: 'Menu', groups: [{ id: 1, name: 'Demo', items: [{ id: 1, name: 'Demo sandwich', price: 12, is_active: true, availability_state: 'in_stock', buildable_count: 50 }] }] }] };
    else if (path.endsWith('/orders') && request.method === 'POST') { response.statusCode = allowed ? 201 : 400; result = allowed ? { order: { id: 1, payment_status: 'pending' } } : { error: 'restaurant has paused online ordering' }; }
    else if (path.includes('/auth/')) response.statusCode = 401;
    response.end(JSON.stringify(result));
  });
  await new Promise<void>(resolve => api.listen(43220, '127.0.0.1', resolve));
});
test.afterAll(async () => { await new Promise<void>((resolve, reject) => api.close(error => error ? reject(error) : resolve())); });

test('visitor access is private, signed through the real proxy and expires in the guest UI', async ({ page, context }) => {
  signedIPs = []; expiry = new Date(Date.now() + 3600000).toISOString();
  await context.setExtraHTTPHeaders({ 'x-vercel-forwarded-for': '203.0.113.10', 'x-foody-test-client-ip': '203.0.113.99' });
  await page.addInitScript(() => localStorage.setItem('foody-locale', 'en'));
  await page.goto('/r/synthetic/order');
  await expect(page.getByText('Test access active until', { exact: false })).toBeVisible({ timeout: 60000 });
  expect(signedIPs).toContain('203.0.113.10');
  const admitted = await context.request.post('/api/customer-api/orders?restaurant_id=9001', { data: { items: [] } });
  expect(admitted.status()).toBe(201);
  await context.setExtraHTTPHeaders({ 'x-vercel-forwarded-for': '203.0.113.11', 'x-foody-test-client-ip': '203.0.113.10' });
  const denied = await context.request.post('/api/customer-api/orders?restaurant_id=9001', { data: { items: [] } });
  expect(denied.status()).toBe(400);
  await page.reload();
  await expect.poll(() => signedIPs.includes('203.0.113.11')).toBe(true);
  await expect(page.getByText('Test access active until', { exact: false })).toHaveCount(0);
  await context.setExtraHTTPHeaders({ 'x-vercel-forwarded-for': '203.0.113.10' });
  expiry = new Date(Date.now() + 5000).toISOString();
  await page.reload();
  await expect(page.getByText('Test access active until', { exact: false })).toBeVisible();
  await expect(page.getByText('Test access active until', { exact: false })).toHaveCount(0, { timeout: 10000 });
  const expired = await context.request.post('/api/customer-api/orders?restaurant_id=9001', { data: { items: [] } });
  expect(expired.status()).toBe(400);
});
