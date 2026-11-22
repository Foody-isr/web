const checkoutOrigins = new Set([
  "https://cst.test-gsc.vfims.com",
  "https://emea.gsc.verifone.cloud",
]);

/** Accept only the Checkout origins configured for Foody's two environments. */
export function verifoneIframeOrigin(raw: string): string | null {
  try {
    const url = new URL(raw);
    return !url.username && !url.password && url.pathname !== "/" && checkoutOrigins.has(url.origin)
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

/** A message can request a status refresh only from the mounted provider frame. */
export function verifoneIframeEvent(event: MessageEvent, frame: Window | null, origin: string): string | null {
  if (!frame || event.source !== frame || event.origin !== origin) return null;
  const data = event.data;
  const type = typeof data === "string" ? data : data?.type ?? data?.eventType;
  return type === "CHECKOUT_COMPLETED" || type === "CHECKOUT_FAILED" ? type : null;
}
