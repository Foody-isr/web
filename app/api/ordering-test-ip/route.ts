import { orderingTestClientIP } from '../../../lib/server/ordering-test-proxy';

export const dynamic = 'force-dynamic';

const adminOrigins = new Set(['https://admin.foody-pos.co.il', 'https://dev-admin.foody-pos.co.il']);

/** Lets Foody Admin detect this browser's IP on the guest ordering host. */
export function GET(request: Request): Response {
  const headers = new Headers({ 'Cache-Control': 'private, no-store', Vary: 'Origin' });
  const origin = request.headers.get('origin');
  if (origin && !adminOrigins.has(origin)) {
    return Response.json({ error: 'origin not allowed' }, { status: 403, headers });
  }
  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  const ip = orderingTestClientIP(request);
  if (!ip) return Response.json({ error: 'client IP unavailable' }, { status: 503, headers });
  return Response.json({ ip }, { headers });
}
