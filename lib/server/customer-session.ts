import "server-only";

import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";
const COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Host-foody_customer"
    : "foody_customer_session";
const SESSION_SECONDS = 30 * 24 * 60 * 60;
const MAX_BODY_BYTES = 256 * 1024;

export function customerAPIURL(path: string): string {
  return `${API_BASE}/api/v1/public/${path.replace(/^\/+/, "")}`;
}

export async function customerSessionToken(): Promise<string | null> {
  return (await cookies()).get(COOKIE_NAME)?.value ?? null;
}

export async function storeCustomerSession(token: string): Promise<void> {
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function clearCustomerSession(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}

export function mutationIsSameOrigin(request: NextRequest): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

export async function boundedRequestBody(
  request: NextRequest,
): Promise<string> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new Error("request body is too large");
  }
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
    throw new Error("request body is too large");
  }
  return body;
}

export function browserSafeResponse(response: Response): Response {
  const headers = new Headers({ "Cache-Control": "no-store" });
  const contentType = response.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  return new Response(response.body, { status: response.status, headers });
}

export async function backendHeaders(
  request: NextRequest,
  options: { authenticated?: boolean } = {},
): Promise<Headers> {
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  const receiptToken = request.headers.get("x-receipt-token");
  if (contentType) headers.set("Content-Type", contentType);
  if (receiptToken) headers.set("X-Receipt-Token", receiptToken);
  if (options.authenticated !== false) {
    const token = await customerSessionToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}
