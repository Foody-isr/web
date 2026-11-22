const sandboxCheckoutOrigin = "https://cst.checkout.vficloud.net";
const legacyCheckoutOrigins = new Set([
  "https://cst.test-gsc.vfims.com",
  "https://emea.gsc.verifone.cloud",
]);
const loaderPath = "/v2/loader.js";
const checkoutUUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** Identify a trusted Checkout loader or a previously supported frame URL. */
export function verifoneIframePresentation(raw: string): { origin: string; kind: "loader" | "frame" } | null {
  try {
    const url = new URL(raw);
    if (url.username || url.password || url.hash || url.pathname === "/") return null;
    const legacyOrigin = legacyCheckoutOrigins.has(url.origin);
    if (!legacyOrigin && url.origin !== sandboxCheckoutOrigin) return null;
    if (url.pathname === loaderPath) {
      const checkout = url.searchParams.get("checkoutId");
      return checkout && checkoutUUID.test(checkout) && url.searchParams.size === 1
        ? { origin: url.origin, kind: "loader" }
        : null;
    }
    return legacyOrigin ? { origin: url.origin, kind: "frame" } : null;
  } catch {
    return null;
  }
}

/** A message can request a status refresh only from the mounted provider frame. */
export function verifoneIframeEvent(event: MessageEvent, frame: Window | null, origin: string): string | null {
  if (!frame || event.source !== frame || event.origin !== origin) return null;
  const data = event.data;
  const type = typeof data === "string" ? data : data?.event ?? data?.type ?? data?.eventType;
  return type === "CHECKOUT_COMPLETED" || type === "CHECKOUT_FAILED" ? type : null;
}
