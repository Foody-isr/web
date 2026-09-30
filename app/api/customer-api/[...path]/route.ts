import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { resolveCustomerAPIPath } from "@/lib/customer-api-proxy";
import {
  backendHeaders,
  boundedRequestBody,
  browserSafeResponse,
  customerAPIURL,
  mutationIsSameOrigin,
} from "@/lib/server/customer-session";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ path: string[] }> };

async function proxy(
  request: NextRequest,
  context: Context,
): Promise<Response> {
  const path = resolveCustomerAPIPath(
    request.method,
    (await context.params).path,
  );
  if (!path) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (request.method !== "GET" && !mutationIsSameOrigin(request)) {
    return NextResponse.json(
      { error: "cross-origin request rejected" },
      { status: 403 },
    );
  }

  let body: string | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    try {
      body = await boundedRequestBody(request);
    } catch {
      return NextResponse.json(
        { error: "request body is too large" },
        { status: 413 },
      );
    }
  }
  const response = await fetch(
    `${customerAPIURL(path)}${request.nextUrl.search}`,
    {
      method: request.method,
      headers: await backendHeaders(request),
      body,
      cache: "no-store",
      redirect: "manual",
    },
  );
  return browserSafeResponse(response);
}

export const GET = proxy;
export const POST = proxy;
export const DELETE = proxy;
