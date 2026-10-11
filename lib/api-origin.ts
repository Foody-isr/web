/** Resolve public API origins from the request host so one artifact can be promoted. */
export function apiOriginForHost(host: string | undefined, fallback: string): string {
  const hostname = (host || '').toLowerCase().split(':')[0];
  if (hostname === 'dev-app.foody-pos.co.il' || hostname.endsWith('.dev-app.foody-pos.co.il')) {
    return 'https://dev-api.foody-pos.co.il';
  }
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname) || hostname.endsWith('.vercel.app')) return fallback;
  // Production restaurant subdomains and verified custom domains share the guest API.
  return 'https://api.foody-pos.co.il';
}

/** Browser API origin; SSR requests are resolved individually by runtimeFetch. */
export function browserApiOrigin(fallback: string): string {
  return apiOriginForHost(typeof window === 'undefined' ? undefined : window.location.hostname, fallback);
}
