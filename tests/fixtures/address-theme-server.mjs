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
  // Optional, entirely synthetic provider exchange for gateway security tests.
  // No SDK token, provider credential or real customer is accepted by this server.
  const socialFixture = process.env.SOCIAL_AUTH_FIXTURE === '1';
  const providerSettings = socialFixture ? {
    facebook: { app_id: '12345', api_version: 'v24.0' },
    apple: { client_id: 'test.foody.web', redirect_uri: 'https://app.example.invalid/' },
  } : {};
  if (path === '/api/v1/public/auth/providers') { response.writeHead(200, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(providerSettings)); return; }
  if (socialFixture && request.method === 'POST' && /^\/api\/v1\/public\/auth\/(apple|facebook)$/.test(path)) {
    let raw = ''; for await (const chunk of request) raw += chunk;
    const body = JSON.parse(raw);
    const provider = path.split('/').at(-1);
    const valid = provider === 'facebook' ? body.access_token === 'synthetic-facebook-token' : /^[a-f0-9]{64}$/.test(body.nonce) && body.code === `synthetic-apple-${body.nonce}`;
    response.writeHead(valid ? 200 : 401, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(valid ? { token: `synthetic-${provider}-session-not-a-real-credential`, account: { id: provider === 'facebook' ? 70008 : 70009, name: `Demo ${provider}`, email: `${provider}@example.invalid` } } : { error: 'synthetic_provider_rejected' })); return;
  }
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
}).listen(Number(process.env.FOODY_FIXTURE_PORT || 18081), '127.0.0.1');
