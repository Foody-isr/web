import { NextRequest, NextResponse } from 'next/server';

import {
  isFoodyHost,
  isNonPageRequest,
  isRestaurantSubdomain,
  isSiteFilePath,
  shouldRedirectRootToMarketing,
} from '@/lib/host-routing';

// ─── Custom domain resolution with in-memory cache ──────────────────

const domainCache = new Map<string, { slug: string; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const MARKETING_URL =
  process.env.NEXT_PUBLIC_MARKETING_URL || 'https://foody-pos.co.il';

async function resolveCustomDomain(domain: string): Promise<string | null> {
  const cleanDomain = domain.split(':')[0].replace(/^www\./, ''); // strip port and www prefix

  const cached = domainCache.get(cleanDomain);
  if (cached && cached.expires > Date.now()) {
    return cached.slug;
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
    domainCache.set(cleanDomain, { slug, expires: Date.now() + CACHE_TTL });
    return slug;
  } catch {
    return null;
  }
}

// ─── Public request context ─────────────────────────────────────────

/**
 * The rewrite below hides the visitor's real host and path from the pages, but
 * metadata (canonical, og:url) and robots.txt must name the public address, not
 * the internal one. Record both, plus the restaurant this host serves, so
 * `lib/site-url.ts` can read them back.
 */
function publicContext(request: NextRequest, slug: string | null) {
  const headers = new Headers(request.headers);
  headers.set('x-foody-host', request.headers.get('host') || '');
  headers.set('x-foody-path', request.nextUrl.pathname);
  if (slug) {
    headers.set('x-foody-slug', slug);
  } else {
    headers.delete('x-foody-slug'); // never trust an inbound value
  }
  return { request: { headers } };
}

/**
 * Routes that live outside /r/[restaurantId]/ and take their context from
 * query params. They must resolve to their own pages, never be rewritten.
 */
function isStandaloneRoute(pathname: string): boolean {
  return (
    pathname.startsWith('/order/checkout') ||
    pathname.startsWith('/order/confirmation') ||
    pathname.startsWith('/order/tracking') ||
    pathname.startsWith('/orders') ||
    pathname.startsWith('/receipt')
  );
}

// ─── Middleware ──────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') || '';
  const pathname = request.nextUrl.pathname;

  // Internals, static files, and anything else that is not a page. Passing
  // these through untouched keeps public/ assets working on custom domains and
  // lets unknown file paths 404 properly instead of reaching the page catch-all.
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    isNonPageRequest(pathname)
  ) {
    return NextResponse.next();
  }

  const isFoodyDomain = isFoodyHost(host);

  // ─── Custom domain handling ─────────────────────────────────────
  // Must run BEFORE the /r/ skip so we can redirect /r/slug/... to clean URLs
  if (!isFoodyDomain) {
    const slug = await resolveCustomDomain(host);
    if (slug) {
      // robots.txt / sitemap.xml render for this host — never rewritten, but
      // they still need the slug to describe the right restaurant.
      if (isSiteFilePath(pathname)) {
        return NextResponse.next(publicContext(request, slug));
      }

      // If path contains /r/slug, redirect to clean URL (e.g. /r/mamie-tlv/order → /order)
      if (pathname.startsWith(`/r/${slug}`)) {
        const cleanPath = pathname.replace(`/r/${slug}`, '') || '/';
        const url = request.nextUrl.clone();
        url.pathname = cleanPath;
        return NextResponse.redirect(url);
      }

      // Skip already-rewritten paths
      if (pathname.startsWith('/r/')) {
        return NextResponse.next(publicContext(request, slug));
      }

      if (isStandaloneRoute(pathname)) {
        return NextResponse.next(publicContext(request, slug));
      }

      // Rewrite to /r/slug internally
      const url = request.nextUrl.clone();
      url.pathname = `/r/${slug}${pathname === '/' ? '' : pathname}`;
      return NextResponse.rewrite(url, publicContext(request, slug));
    }
  }

  // Skip /r/ paths for non-custom-domain requests
  if (pathname.startsWith('/r/')) {
    return NextResponse.next(publicContext(request, pathname.split('/')[2] || null));
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
    const slug = host.split('.')[0];

    if (isSiteFilePath(pathname)) {
      return NextResponse.next(publicContext(request, slug));
    }

    const url = request.nextUrl.clone();
    url.pathname = `/r/${slug}${pathname === '/' ? '' : pathname}`;
    return NextResponse.rewrite(url, publicContext(request, slug));
  }

  return NextResponse.next(publicContext(request, null));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo|sw.js).*)'],
};
