import { createServer } from 'node:http';
import { orderEntryResponse } from './order-entry-data.mjs';

// Server-rendered theme requests cannot be intercepted by browser route mocks.
// Serve only synthetic public theme data; never proxy to an actual API.
const restaurant = {
  id: 9001, name: 'Foody Demo', slug: 'foody-demo', address: '12 Demo Street',
  currency: 'ILS', timezone: 'Asia/Jerusalem', pickup_enabled: true,
  delivery_enabled: true, website_config: {},
};

createServer(async (request, response) => {
  const { pathname: path, searchParams } = new URL(request.url, 'http://127.0.0.1');
  // Also support manual Safari/iOS keyboard checks against the synthetic storefront.
  if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(request.headers.origin ?? '')) response.setHeader('Access-Control-Allow-Origin', request.headers.origin);
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
  const syntheticAddress = ['49003', '49005', '49006'].includes(searchParams.get('restaurant_id'));
  let addressData;
  if (syntheticAddress && path === '/api/v1/public/address-autocomplete/config') addressData = { available: true, enabled: true, provider: 'google' };
  if (syntheticAddress && path === '/api/v1/public/address-autocomplete') addressData = { suggestions: [
    { id: 'street', address: 'Demo Street', city: 'Test City', kind: 'prediction', lookup_token: 'synthetic-street' },
    ...Array.from({ length: 7 }, (_, i) => ({ id: String(i), address: `${i + 1} Demo Street`, city: 'Test City', kind: 'prediction', lookup_token: `synthetic-${i + 1}` })),
  ] };
  if (syntheticAddress && path === '/api/v1/public/address-autocomplete/resolve') {
    let body = '';
    for await (const chunk of request) body += chunk;
    const choice = JSON.parse(body).lookup_token;
    const number = /^synthetic-[1-7]$/.test(choice) ? choice.slice(-1) : '';
    addressData = { suggestion: { id: choice, kind: number ? 'address' : 'street', street: 'Demo Street', address: number ? `${number} Demo Street` : 'Demo Street', city: 'Test City', ...(number ? { token: `synthetic-selected-${number}` } : {}) } };
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (syntheticAddress && path === '/api/v1/public/delivery/check') addressData = { resolved: true, deliverable: true, delivery_fee: 10 };
  const data = addressData ?? (request.method === 'GET'
    ? orderEntryResponse(path, searchParams) ?? (path === '/api/v1/public/restaurants/9001' ? { restaurant }
      : path === '/api/v1/public/restaurants/9001/website-pages' ? { pages: [] }
        : null)
    : null);
  response.writeHead(data ? 200 : 404, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(data ?? { error: 'synthetic_fixture_only' }));
}).listen(18081, '127.0.0.1');
