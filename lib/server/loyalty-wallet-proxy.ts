import "server-only";
import { NextRequest, NextResponse } from "next/server";
import {
  loyaltyExpectedAccount,
  loyaltyOwnerMatches,
  loyaltyWebEnabled,
} from "../loyalty";
import {
  checkedGoogleWalletURL,
  checkedWalletAssertion,
  checkedWalletCapabilities,
  loyaltyWalletEnabled,
  walletCustomerAction,
  walletRestaurant,
  walletReturnPath,
} from "../loyalty-wallet";
import {
  backendHeaders,
  customerAPIURL,
  mutationIsSameOrigin,
} from "./customer-session";

const noStore = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};
const active = () => loyaltyWebEnabled && loyaltyWalletEnabled;
const reply = (status: number, error: string) =>
  NextResponse.json({ error }, { status, headers: noStore });
class WalletGatewayError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
function fail(status = 503, code = "wallet_unavailable"): never {
  throw new WalletGatewayError(status, code);
}
function sameOrigin(request: NextRequest) {
  if (!mutationIsSameOrigin(request)) return false;
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}
async function boundedBytes(
  stream: ReadableStream<Uint8Array> | null,
  max: number,
): Promise<Uint8Array> {
  if (!stream) return new Uint8Array();
  const reader = stream.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > max) {
        await reader.cancel();
        fail(413, "wallet_invalid");
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    result.set(chunk, at);
    at += chunk.length;
  }
  return result;
}
async function textBody(request: NextRequest, max: number) {
  if (Number(request.headers.get("content-length")) > max)
    fail(413, "wallet_invalid");
  return new TextDecoder("utf-8", { fatal: true }).decode(
    await boundedBytes(request.body, max),
  );
}
async function jsonResponse(response: Response, max: number) {
  return JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(
      await boundedBytes(response.body, max),
    ),
  );
}
async function ownedHeaders(request: NextRequest, expected: number) {
  // Capture the HttpOnly credential once. Caller Authorization/receipt never authenticates Wallet.
  const headers = await backendHeaders(request);
  headers.delete("X-Receipt-Token");
  headers.set("Content-Type", "application/json");
  if (!headers.has("Authorization")) fail(401, "wallet_sign_in_required");
  const me = await fetch(await customerAPIURL("me"), {
    headers,
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(8_000),
  });
  if (me.status === 401 || me.status === 403)
    fail(401, "wallet_sign_in_required");
  if (!me.ok) fail();
  if (!loyaltyOwnerMatches(await jsonResponse(me, 16_384), expected))
    fail(409, "wallet_session_changed");
  return headers;
}
function checkUpstream(response: Response) {
  if (response.status >= 300 && response.status < 400) fail();
  if (!response.ok) {
    if (response.status === 401 || response.status === 403)
      fail(401, "wallet_sign_in_required");
    if (response.status === 404) fail(404, "wallet_not_available");
    if (response.status === 409) fail(409, "wallet_changed");
    if (response.status === 400) fail(400, "wallet_invalid");
    if (response.status === 429) fail(429, "wallet_rate_limited");
    fail();
  }
}
function errorReply(error: unknown) {
  return error instanceof WalletGatewayError
    ? reply(error.status, error.code)
    : reply(503, "wallet_unavailable");
}

/** Proxy only owned metadata, Google issuance and explicit card revocation. */
export async function proxyLoyaltyWalletRequest(
  request: NextRequest,
  path: string,
): Promise<Response> {
  if (!active()) return reply(404, "not_found");
  const action = walletCustomerAction(request.method, path);
  if (!action) return reply(404, "not_found");
  if (request.method !== "GET" && !sameOrigin(request))
    return reply(403, "wallet_origin_rejected");
  try {
    const query = request.nextUrl.searchParams,
      rid = walletRestaurant(query.get("restaurant_id"));
    const expected = loyaltyExpectedAccount(
      request.headers.get("x-foody-loyalty-account"),
    );
    if (!rid || expected === null || [...query.keys()].length !== 1)
      fail(400, "wallet_invalid");
    let body: string | undefined;
    if (action === "google") {
      if (
        request.headers
          .get("content-type")
          ?.split(";")[0]
          .trim()
          .toLowerCase() !== "application/json"
      )
        fail(415, "wallet_invalid");
      try {
        body = JSON.stringify(
          checkedWalletAssertion(JSON.parse(await textBody(request, 512))),
        );
      } catch (e) {
        if (e instanceof WalletGatewayError) throw e;
        fail(400, "wallet_invalid");
      }
    } else if (action === "revoke" && (await textBody(request, 1)) !== "")
      fail(400, "wallet_invalid");
    const headers = await ownedHeaders(request, expected);
    const response = await fetch(
      `${await customerAPIURL(path)}?restaurant_id=${rid}`,
      {
        method: request.method,
        headers,
        body,
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(30_000),
      },
    );
    checkUpstream(response);
    if (action === "revoke") {
      if (response.status !== 204) fail();
      return new Response(null, { status: 204, headers: noStore });
    }
    if (response.status !== 200) fail();
    const result = await jsonResponse(
      response,
      action === "read" ? 16_384 : 4096,
    );
    return action === "read"
      ? NextResponse.json(checkedWalletCapabilities(result), {
          headers: noStore,
        })
      : NextResponse.json(
          { save_url: checkedGoogleWalletURL(result) },
          { headers: noStore },
        );
  } catch (error) {
    return errorReply(error);
  }
}

/** Return the owned signed archive through a native form navigation, not a UI blob. */
export async function downloadAppleWallet(
  request: NextRequest,
): Promise<Response> {
  if (!active()) return reply(404, "not_found");
  if (!sameOrigin(request)) return reply(403, "wallet_origin_rejected");
  let returnPath = "/";
  try {
    if (
      [...request.nextUrl.searchParams].length ||
      request.headers
        .get("content-type")
        ?.split(";")[0]
        .trim()
        .toLowerCase() !== "application/x-www-form-urlencoded"
    )
      fail(400, "wallet_invalid");
    const form = new URLSearchParams(await textBody(request, 1024));
    const rid = walletRestaurant(form.get("restaurant_id")),
      expected = loyaltyExpectedAccount(form.get("expected_account"));
    if (rid) returnPath = `/r/${rid}/account/loyalty`;
    if (rid && walletReturnPath(rid, form.get("return_path")))
      returnPath = form.get("return_path")!;
    const keys = [
      "restaurant_id",
      "expected_account",
      "membership_id",
      "program_id",
      "return_path",
    ];
    if (
      !rid ||
      expected === null ||
      [...form.keys()].length !== keys.length ||
      keys.some((key) => form.getAll(key).length !== 1) ||
      !walletReturnPath(rid, form.get("return_path"))
    )
      fail(400, "wallet_invalid");
    const assertion = checkedWalletAssertion({
      membership_id: form.get("membership_id"),
      program_id: form.get("program_id"),
    });
    const headers = await ownedHeaders(request, expected);
    const response = await fetch(
      `${await customerAPIURL("loyalty/wallet/cards/apple")}?restaurant_id=${rid}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(assertion),
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(30_000),
      },
    );
    checkUpstream(response);
    if (
      response.status !== 200 ||
      response.headers
        .get("content-type")
        ?.split(";")[0]
        .trim()
        .toLowerCase() !== "application/vnd.apple.pkpass"
    )
      fail();
    const archive = await boundedBytes(response.body, 512 * 1024);
    if (
      archive.length < 4 ||
      archive[0] !== 0x50 ||
      archive[1] !== 0x4b ||
      archive[2] !== 3 ||
      archive[3] !== 4
    )
      fail();
    return new Response(archive.buffer as ArrayBuffer, {
      headers: {
        ...noStore,
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": 'inline; filename="foody-loyalty.pkpass"',
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const code =
      error instanceof WalletGatewayError ? error.code : "wallet_unavailable";
    const target = new URL(returnPath, request.nextUrl.origin);
    target.searchParams.set("wallet_result", code);
    return NextResponse.redirect(target, { status: 303, headers: noStore });
  }
}

/** Keep the disabled file endpoint absent even for GET probes. */
export function appleWalletGet(): Response {
  return reply(active() ? 405 : 404, "not_found");
}
