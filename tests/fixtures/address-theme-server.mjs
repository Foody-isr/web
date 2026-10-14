import { createServer } from 'node:http';

// Server-rendered theme requests cannot be intercepted by browser route mocks.
// Serve only synthetic public theme data; never proxy to an actual API.
const restaurant = {
  id: 9001, name: 'Foody Demo', slug: 'foody-demo', address: '12 Demo Street',
  currency: 'ILS', timezone: 'Asia/Jerusalem', pickup_enabled: true,
  delivery_enabled: true, website_config: {},
};

createServer((request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1').pathname;
  const data = request.method === 'GET'
    ? path === '/api/v1/public/restaurants/9001' ? { restaurant }
      : path === '/api/v1/public/restaurants/9001/website-pages' ? { pages: [] }
        : null
    : null;
  response.writeHead(data ? 200 : 404, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(data ?? { error: 'synthetic_fixture_only' }));
}).listen(18081, '127.0.0.1');
