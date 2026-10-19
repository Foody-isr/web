import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { orderingTestProxyHeaders } from "@/lib/server/ordering-test-proxy";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { validCustomerSocialFlow, type CustomerSocialProvider } from "@/lib/customer-social-flow";

import {
  backendHeaders,
  boundedRequestBody,
  browserSafeResponse,
  clearCustomerSession,
  customerAPIURL,
  customerSessionToken,
  mutationIsSameOrigin,
  storeCustomerSession,
} from "@/lib/server/customer-session";

export const dynamic = "force-dynamic";

const POST_ROUTES: Record<string, { backend: string; opensSession?: boolean }> =
  {
    google: { backend: "auth/google", opensSession: true },
    facebook: { backend: "auth/facebook", opensSession: true },
    apple: { backend: "auth/apple", opensSession: true },
    "email/register": { backend: "auth/email/register" },
    checkout: { backend: "auth/checkout", opensSession: true },
    "email/resend": { backend: "auth/email/resend" },
    "email/verify": { backend: "auth/email/verify", opensSession: true },
    "email/login": { backend: "auth/email/login", opensSession: true },
    "email/code": { backend: "auth/email/code" },
    "email/code/verify": { backend: "auth/email/code/verify", opensSession: true },
    "email/password/forgot": { backend: "auth/email/password/forgot" },
    "email/password/reset": { backend: "auth/email/password/reset" },
  };

type Context = { params: Promise<{ path: string[] }> };

export async function GET(
  request: NextRequest,
  context: Context,
): Promise<Response> {
  const path = (await context.params).path.join("/");
  if (path === "providers") {
    const response = await fetch(await customerAPIURL("auth/providers"), { cache: "no-store" });
    return browserSafeResponse(response);
  }
  if (path !== "session")
    return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!(await customerSessionToken())) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }
  const response = await fetch(await customerAPIURL("me"), {
    headers: await backendHeaders(request),
    cache: "no-store",
  });
  if (response.status === 401) await clearCustomerSession();
  return browserSafeResponse(response);
}

export async function POST(
  request: NextRequest,
  context: Context,
): Promise<Response> {
  if (!mutationIsSameOrigin(request)) {
    return NextResponse.json(
      { error: "cross-origin request rejected" },
      { status: 403 },
    );
  }
  const path = (await context.params).path.join("/");
  const socialStart = /^social\/(facebook|apple)\/start$/.exec(path);
  if (socialStart) {
    const response = await fetch(await customerAPIURL("auth/providers"), { cache: "no-store" });
    if (!response.ok) return browserSafeResponse(response);
    const provider = socialStart[1] as CustomerSocialProvider;
    const settings = (await response.json()) as Record<string, unknown>;
    if (!settings[provider]) return NextResponse.json({ error: "sign-in method unavailable" }, { status: 503 });
    const flow = { provider, state: randomBytes(32).toString("hex"), nonce: randomBytes(32).toString("hex"), createdAt: Date.now() };
    (await cookies()).set(socialCookie(provider), JSON.stringify(flow), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 600,
    });
    return NextResponse.json({ ...flow, settings: settings[provider] }, { headers: { "Cache-Control": "no-store" } });
  }
  if (path === "logout") {
    await fetch(await customerAPIURL("auth/logout"), {
      method: "POST",
      headers: await backendHeaders(request),
      cache: "no-store",
    }).catch(() => null);
    await clearCustomerSession();
    return new Response(null, { status: 204 });
  }
  const route = POST_ROUTES[path];
  if (!route) return NextResponse.json({ error: "not found" }, { status: 404 });

  let body: string;
  try {
    body = await boundedRequestBody(request);
  } catch {
    return NextResponse.json(
      { error: "request body is too large" },
      { status: 413 },
    );
  }
  if (path === "facebook" || path === "apple") {
    let input: Record<string, unknown>;
    let flow: unknown;
    try {
      input = JSON.parse(body) as Record<string, unknown>;
      flow = JSON.parse((await cookies()).get(socialCookie(path))?.value ?? "null");
    } catch { return NextResponse.json({ error: "invalid sign-in flow" }, { status: 400 }); }
    if (!input || !validCustomerSocialFlow(flow, path, input.state)) return NextResponse.json({ error: "sign-in flow expired" }, { status: 403 });
    (await cookies()).set(socialCookie(path), "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
    body = JSON.stringify(path === "facebook" ? { access_token: input.access_token } : { code: input.code, nonce: flow.nonce, name: input.name });
  }
  const url = await customerAPIURL(route.backend);
  const headers = await backendHeaders(request, { authenticated: path === "google" || path === "apple" || path === "email/code/verify" });
  if (path === "checkout" || path === "facebook" || path === "apple") orderingTestProxyHeaders(request, url, body).forEach((value, key) => headers.set(key, value));
  const response = await fetch(url, {
    method: "POST",
    headers,
    body,
    cache: "no-store",
  });
  if (!route.opensSession || !response.ok) return browserSafeResponse(response);

  const data = (await response.json()) as { token?: string; account?: unknown };
  if (!data.token || !data.account) {
    return NextResponse.json(
      { error: "invalid authentication response" },
      { status: 502 },
    );
  }
  await storeCustomerSession(data.token);
  return NextResponse.json(
    { account: data.account },
    { status: response.status, headers: { "Cache-Control": "no-store" } },
  );
}

function socialCookie(provider: CustomerSocialProvider): string {
  return `${process.env.NODE_ENV === "production" ? "__Host-" : ""}foody_customer_oauth_${provider}`;
}
