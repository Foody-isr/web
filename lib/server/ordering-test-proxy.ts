import { createHash, createHmac } from 'node:crypto';
import { isIP } from 'node:net';

/** Returns the same platform-owned client IP used for ordering test signatures. */
export function orderingTestClientIP(request: { headers: Headers }, vercel = process.env.VERCEL === '1'): string | null {
  // Vercel overwrites this canonical header at its edge to prevent IP spoofing.
  // Self-hosted/local incoming headers are not a trustworthy IP source.
  const ip = request.headers.get('x-forwarded-for')?.trim() ?? '';
  return vercel && isIP(ip) ? ip : null;
}

/** Signs only Vercel's platform-owned IP, binding it to this backend request. */
export function orderingTestProxyHeaders(
  request: { headers: Headers; method: string },
  backendURL: string,
  body = '',
  options: { secret?: string; vercel?: boolean; now?: number } = {},
): Headers {
  const headers = new Headers();
  const url = new URL(backendURL);
  const environmentSecret = url.hostname === 'dev-api.foody-pos.co.il'
    ? process.env.ORDERING_TEST_PROXY_SECRET_DEV
    : process.env.ORDERING_TEST_PROXY_SECRET;
  const secret = options.secret ?? environmentSecret ?? '';
  const ip = orderingTestClientIP(request, options.vercel);
  if (!ip || secret.length < 32) return headers;
  const timestamp = String(Math.floor((options.now ?? Date.now()) / 1000));
  const digest = createHash('sha256').update(body).digest('hex');
  const message = [timestamp, ip, request.method, url.pathname + url.search, digest].join('\n');
  headers.set('X-Foody-Test-Client-IP', ip);
  headers.set('X-Foody-Test-Timestamp', timestamp);
  headers.set('X-Foody-Test-Signature', createHmac('sha256', secret).update(message).digest('hex'));
  return headers;
}
