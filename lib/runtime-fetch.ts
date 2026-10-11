import { browserApiOrigin } from './api-origin';

/** Fetch in a browser; callers have already resolved the current public hostname. */
export async function runtimeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return globalThis.fetch(input, init);
}

/** Resolve link URLs alongside requests when rendering public content. */
export async function runtimeApiOrigin(): Promise<string> {
  return browserApiOrigin(process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080');
}
