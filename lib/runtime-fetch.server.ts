import 'server-only';
import { headers } from 'next/headers';
import { apiOriginForHost } from './api-origin';

/** Resolve each SSR API request independently, including after artifact promotion. */
export async function runtimeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
  if (typeof input === 'string' && input.startsWith(`${configured}/api/v1/`)) {
    const request = await headers();
    const origin = apiOriginForHost(request.get('host') ?? undefined, configured);
    input = origin + input.slice(configured.length);
  }
  return globalThis.fetch(input, init);
}
