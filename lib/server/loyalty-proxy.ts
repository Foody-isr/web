import {
  checkedLoyaltyCheckoutBody,
  isLoyaltyCheckoutPath,
} from "../loyalty-checkout";
import { orderingTestProxyHeaders } from "./ordering-test-proxy";
import "server-only";
import { NextRequest, NextResponse } from "next/server";
import {
  checkedLoyaltyEnrollment,
  loyaltyExpectedAccount,
  loyaltyOwnerMatches,
  loyaltyCustomerQuery,
} from "../loyalty";
import {
  backendHeaders,
  boundedRequestBody,
  browserSafeResponse,
  customerAPIURL,
  mutationIsSameOrigin,
} from "./customer-session";

function reply(status: number, error: string): Response {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

/** Forward a narrow loyalty request using one captured HttpOnly session identity.
 * The consistency header never authenticates the browser: /me verifies the same
 * captured credential used for the subsequent membership request.
 */
export async function proxyLoyaltyRequest(
  request: NextRequest,
  path: string,
): Promise<Response> {
  const query = loyaltyCustomerQuery(path, request.nextUrl.searchParams);
  if (!query) return reply(400, "loyalty_invalid");
  if (request.method !== "GET" && !mutationIsSameOrigin(request))
    return reply(403, "loyalty_origin_rejected");
  const personal = path !== "loyalty/program";
  const expected = loyaltyExpectedAccount(
    request.headers.get("x-foody-loyalty-account"),
  );
  if (personal && expected === null) return reply(400, "loyalty_invalid");
  const checkout = isLoyaltyCheckoutPath(path);
  const cancellation = checkout && path.endsWith("/cancel");
  const limit = checkout && !cancellation ? 256 * 1024 : 4096;
  let body: string | undefined;
  if (request.method === "POST" && !cancellation) {
    if (Number(request.headers.get("content-length")) > limit)
      return reply(413, "loyalty_invalid");
    if (
      request.headers
        .get("content-type")
        ?.split(";")[0]
        .trim()
        .toLowerCase() !== "application/json"
    )
      return reply(415, "loyalty_json_required");
    try {
      const raw = await boundedRequestBody(request);
      if (new TextEncoder().encode(raw).byteLength > limit)
        return reply(413, "loyalty_invalid");
      body = JSON.stringify(
        checkout
          ? checkedLoyaltyCheckoutBody(JSON.parse(raw))
          : checkedLoyaltyEnrollment(JSON.parse(raw)),
      );
    } catch {
      return reply(400, "loyalty_invalid");
    }
  }
  if (cancellation && request.body) {
    const reader = request.body.getReader();
    try {
      const first = await reader.read();
      if (!first.done) {
        await reader.cancel();
        return reply(400, "loyalty_invalid");
      }
    } catch {
      return reply(400, "loyalty_invalid");
    } finally {
      reader.releaseLock();
    }
  }
  try {
    const headers = await backendHeaders(request, { authenticated: personal });
    // Loyalty does not use receipt credentials or caller-provided authorization.
    headers.delete("X-Receipt-Token");
    if (personal) {
      if (!headers.has("Authorization"))
        return reply(401, "loyalty_sign_in_required");
      const me = await fetch(await customerAPIURL("me"), {
        headers,
        cache: "no-store",
        redirect: "manual",
      });
      if (me.status === 401 || me.status === 403)
        return reply(401, "loyalty_sign_in_required");
      if (!me.ok) return reply(503, "loyalty_unavailable");
      if (!loyaltyOwnerMatches(await me.json(), expected!))
        return reply(409, "loyalty_session_changed");
    }
    const url = `${await customerAPIURL(path)}?${query}`;
    if (checkout && path === "loyalty/checkouts")
      orderingTestProxyHeaders(request, url, body).forEach((value, key) =>
        headers.set(key, value),
      );
    const response = await fetch(url, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
    });
    if (response.status >= 300 && response.status < 400)
      return reply(503, "loyalty_unavailable");
    return browserSafeResponse(response);
  } catch {
    return reply(503, "loyalty_unavailable");
  }
}
