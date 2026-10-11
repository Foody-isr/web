import 'server-only';
import { headers } from 'next/headers';
import { apiOriginForHost } from './api-origin';

/** Resolve each SSR API request independently, including after artifact promotion. */
export async function runtimeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
  if (typeof input === 'string' && input.startsWith(`${configured}/api/v1/`)) {
    const origin = await runtimeApiOrigin();
    input = origin + input.slice(configured.length);
  }
  return globalThis.fetch(input, init);
}

/** Resolve public links using this server request, never a shared module cache. */
export async function runtimeApiOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
  const request = await headers();
  return apiOriginForHost(request.get('host') ?? undefined, configured);
}
