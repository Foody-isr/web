import { NextRequest, NextResponse } from 'next/server';

import {
  isFoodyHost,
  isRestaurantSubdomain,
  shouldRedirectRootToMarketing,
} from '@/lib/host-routing';

// ─── Custom domain resolution with in-memory cache ──────────────────

type DomainResolution = { slug: string; chainSlug?: string };

const domainCache = new Map<string, DomainResolution & { expires: number }>();
const chainSlugCache = new Map<string, { exists: boolean; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const NEGATIVE_CHAIN_TTL = 15 * 1000; // newly-created chain URLs become routable quickly
const MARKETING_URL =
  process.env.NEXT_PUBLIC_MARKETING_URL || 'https://foody-pos.co.il';

async function resolveCustomDomain(domain: string): Promise<DomainResolution | null> {
  const cleanDomain = domain.split(':')[0].replace(/^www\./, ''); // strip port and www prefix

  const cached = domainCache.get(cleanDomain);
  if (cached && cached.expires > Date.now()) {
    return { slug: cached.slug, chainSlug: cached.chainSlug };
  }

  try {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
    const res = await fetch(
      `${apiBase}/api/v1/public/restaurants/by-domain/${encodeURIComponent(cleanDomain)}`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const slug = data.slug as string;
    if (!slug) return null;
    const resolution = {
      slug,
      chainSlug: typeof data.chain_slug === 'string' && data.chain_slug ? data.chain_slug : undefined,
    };
    domainCache.set(cleanDomain, { ...resolution, expires: Date.now() + CACHE_TTL });
    return resolution;
  } catch {
    return null;
  }
}

async function isPublicChainSlug(slug: string): Promise<boolean> {
  const cached = chainSlugCache.get(slug);
  if (cached && cached.expires > Date.now()) return cached.exists;
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
    const res = await fetch(
      `${apiBase}/api/v1/public/chains/${encodeURIComponent(slug)}/order-entry?order_type=pickup`,
      { cache: 'no-store', signal: AbortSignal.timeout(3000) },
    );
    const exists = res.ok;
    chainSlugCache.set(slug, {
      exists,
      expires: Date.now() + (exists ? CACHE_TTL : NEGATIVE_CHAIN_TTL),
    });
    return exists;
  } catch {
    return false;
  }
}

// ─── Middleware ──────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') || '';
  const parts = host.split('.');
  const pathname = request.nextUrl.pathname;

  // Skip static/internal paths early
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname === '/sw.js'
  ) {
    return NextResponse.next();
  }

  const isFoodyDomain = isFoodyHost(host);

  // ─── Custom domain handling ─────────────────────────────────────
  // Must run BEFORE the /r/ skip so we can redirect /r/slug/... to clean URLs
  if (!isFoodyDomain) {
    const resolved = await resolveCustomDomain(host);
    if (resolved) {
      const { slug, chainSlug } = resolved;
      // If path contains /r/slug, redirect to clean URL (e.g. /r/mamie-tlv/order → /order)
      if (pathname.startsWith(`/r/${slug}`)) {
        const cleanPath = pathname.replace(`/r/${slug}`, '') || '/';
        const url = request.nextUrl.clone();
        url.pathname = cleanPath;
        return NextResponse.redirect(url);
      }

      // Skip already-rewritten paths
      if (pathname.startsWith('/r/')) {
        return NextResponse.next();
      }

      // These routes live outside /r/[restaurantId]/ and use query params for context.
      // Do NOT rewrite them — they must resolve to their own pages.
      if (
        pathname.startsWith('/order/checkout') ||
        pathname.startsWith('/order/confirmation') ||
        pathname.startsWith('/order/tracking') ||
        pathname.startsWith('/orders') ||
        pathname.startsWith('/receipt')
      ) {
        return NextResponse.next();
      }

      if ((pathname === '/' || pathname === '/order') && chainSlug) {
        const url = request.nextUrl.clone();
        url.pathname = `/c/${chainSlug}${pathname === '/' ? '' : pathname}`;
        return NextResponse.rewrite(url);
      }

      // Rewrite to /r/slug internally
      const url = request.nextUrl.clone();
      url.pathname = `/r/${slug}${pathname === '/' ? '' : pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  // Skip /r/ paths for non-custom-domain requests
  if (pathname.startsWith('/r/')) {
    return NextResponse.next();
  }

  // ─── Foody app root → marketing site ────────────────────────────
  // Gated on the host, and deliberately a temporary redirect: a permanent one
  // is cached by the browser indefinitely, so a misfire would follow a guest
  // around long after the server was fixed.
  if (shouldRedirectRootToMarketing(host, pathname)) {
    return NextResponse.redirect(`${MARKETING_URL}/he`, 307);
  }

  // Rewrite {slug}.app.foody-pos.co.il (or {slug}.localhost in dev) to /r/slug
  if (isRestaurantSubdomain(host)) {
    const slug = parts[0];

    // A public chain owns the clean root and /order on its brand subdomain.
    // Explicit /r/<branch> URLs still bypass this block above, so every branch
    // keeps a direct order page even when its original slug names the chain.
    if ((pathname === '/' || pathname === '/order') && await isPublicChainSlug(slug)) {
      const url = request.nextUrl.clone();
      url.pathname = `/c/${slug}${pathname === '/' ? '' : pathname}`;
      return NextResponse.rewrite(url);
    }

    // Rewrite: slug.domain/path → /r/slug/path (internal rewrite, URL stays the same)
    const url = request.nextUrl.clone();
    url.pathname = `/r/${slug}${pathname === '/' ? '' : pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo|sw.js).*)'],
};
