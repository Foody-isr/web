import { NextRequest, NextResponse } from 'next/server';

// ─── Custom domain resolution with in-memory cache ──────────────────

const domainCache = new Map<string, { slug: string; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function resolveCustomDomain(domain: string): Promise<string | null> {
  const cleanDomain = domain.split(':')[0]; // strip port

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

// ─── Middleware ──────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') || '';
  const parts = host.split('.');
  const pathname = request.nextUrl.pathname;

  // Skip internal paths early
  if (
    pathname.startsWith('/r/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname === '/sw.js'
  ) {
    return NextResponse.next();
  }

  // Skip known non-restaurant subdomains and localhost
  const skipSubdomains = ['www', 'app', 'dev-app'];

  // Detect restaurant subdomain: {slug}.app.foody-pos.co.il has 4+ parts
  // or {slug}.localhost has 2+ parts in dev
  const isLocalhost = host.includes('localhost');
  const minParts = isLocalhost ? 2 : 4; // slug.localhost vs slug.app.foody-pos.co.il

  if (parts.length >= minParts && !skipSubdomains.includes(parts[0])) {
    const slug = parts[0];

    // Rewrite: slug.domain/path → /r/slug/path (internal rewrite, URL stays the same)
    const url = request.nextUrl.clone();
    url.pathname = `/r/${slug}${pathname === '/' ? '' : pathname}`;
    return NextResponse.rewrite(url);
  }

  // Backward compat: if on subdomain and path has /r/slug, redirect to clean URL
  if (parts.length >= minParts && !skipSubdomains.includes(parts[0]) && pathname.startsWith('/r/')) {
    const slug = parts[0];
    const pathSlug = pathname.split('/')[2];
    if (pathSlug === slug) {
      const cleanPath = pathname.replace(`/r/${slug}`, '') || '/';
      const url = request.nextUrl.clone();
      url.pathname = cleanPath;
      return NextResponse.redirect(url);
    }
  }

  // ─── Custom domain resolution ─────────────────────────────────────
  // If the host is NOT a known Foody domain, try resolving as a custom domain
  const isFoodyDomain = host.includes('foody-pos.co.il') || isLocalhost;
  if (!isFoodyDomain) {
    const slug = await resolveCustomDomain(host);
    if (slug) {
      const url = request.nextUrl.clone();
      url.pathname = `/r/${slug}${pathname === '/' ? '' : pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo|sw.js).*)'],
};
