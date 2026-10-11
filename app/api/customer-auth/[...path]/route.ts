import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

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
    "email/register": { backend: "auth/email/register" },
    "email/resend": { backend: "auth/email/resend" },
    "email/verify": { backend: "auth/email/verify", opensSession: true },
    "email/login": { backend: "auth/email/login", opensSession: true },
    "email/password/forgot": { backend: "auth/email/password/forgot" },
    "email/password/reset": { backend: "auth/email/password/reset" },
  };

type Context = { params: Promise<{ path: string[] }> };

export async function GET(
  request: NextRequest,
  context: Context,
): Promise<Response> {
  const path = (await context.params).path.join("/");
  if (path !== "session")
    return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!(await customerSessionToken())) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }
  const response = await fetch(customerAPIURL("me"), {
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
  if (path === "logout") {
    await fetch(customerAPIURL("auth/logout"), {
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
  const response = await fetch(customerAPIURL(route.backend), {
    method: "POST",
    headers: await backendHeaders(request, { authenticated: false }),
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
