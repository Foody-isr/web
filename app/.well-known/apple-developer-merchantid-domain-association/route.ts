import type { NextRequest } from "next/server";
import { checkoutRequestHostname, customerAPIURL } from "@/lib/server/customer-session";

export const dynamic = "force-dynamic";

/** Serves the Apple merchant association registered for the requested domain. */
export async function GET(request: NextRequest) {
  const url = new URL(await customerAPIURL("payment-methods/apple-pay/association"));
  url.searchParams.set("domain", checkoutRequestHostname(request));
  try {
    const response = await fetch(url, { cache: "no-store", redirect: "error" });
    return new Response(response.ok ? response.body : null, {
      status: response.status,
      headers: { "Content-Type": "application/octet-stream", "Cache-Control": "no-store" },
    });
  } catch {
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
