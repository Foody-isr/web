/** Fetch in a browser; callers have already resolved the current public hostname. */
export async function runtimeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return globalThis.fetch(input, init);
}
