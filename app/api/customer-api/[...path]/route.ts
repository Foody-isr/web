import { proxyLoyaltyWalletRequest } from "@/lib/server/loyalty-wallet-proxy";
import { walletCustomerAction } from "@/lib/loyalty-wallet";
import { proxyLoyaltyRequest } from "@/lib/server/loyalty-proxy";
import { loyaltyExpectedAccount, loyaltyOwnerMatches, isLoyaltyCustomerPath } from "@/lib/loyalty";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { orderingTestProxyHeaders } from "@/lib/server/ordering-test-proxy";
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
  if (!path) return NextResponse.json({ error: "not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  if (walletCustomerAction(request.method,path)) return proxyLoyaltyWalletRequest(request,path);
  if (isLoyaltyCustomerPath(path)) return proxyLoyaltyRequest(request, path);
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
  const url = `${await customerAPIURL(path)}${request.nextUrl.search}`;
  const headers = await backendHeaders(request);
  if(path==="me/checkout-profile" && request.headers.has("x-foody-loyalty-account")) {
    const expected=loyaltyExpectedAccount(request.headers.get("x-foody-loyalty-account"));
    if(expected===null) return NextResponse.json({error:"loyalty_invalid"},{status:400,headers:{"Cache-Control":"no-store"}});
    if(!headers.has("Authorization")) return NextResponse.json({error:"loyalty_sign_in_required"},{status:401,headers:{"Cache-Control":"no-store"}});
    try {
      const me=await fetch(await customerAPIURL("me"),{headers,cache:"no-store",redirect:"manual"});
      if(me.status===401||me.status===403) return NextResponse.json({error:"loyalty_sign_in_required"},{status:401,headers:{"Cache-Control":"no-store"}});
      if(!me.ok) throw new Error();
      if(!loyaltyOwnerMatches(await me.json(),expected)) return NextResponse.json({error:"loyalty_session_changed"},{status:409,headers:{"Cache-Control":"no-store"}});
    } catch {return NextResponse.json({error:"loyalty_unavailable"},{status:503,headers:{"Cache-Control":"no-store"}})}
  }
  orderingTestProxyHeaders(request, url, body).forEach((value, key) => headers.set(key, value));
  const response = await fetch(
    url,
    {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
    },
  );
  return browserSafeResponse(response);
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
