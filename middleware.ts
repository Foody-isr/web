import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || '';
  const parts = host.split('.');
  const pathname = request.nextUrl.pathname;

  // Skip known non-restaurant subdomains and localhost
  const skipSubdomains = ['www', 'app', 'dev-app'];

  // Detect restaurant subdomain: {slug}.app.foody-pos.co.il has 4+ parts
  // or {slug}.localhost has 2+ parts in dev
  const isLocalhost = host.includes('localhost');
  const minParts = isLocalhost ? 2 : 4; // slug.localhost vs slug.app.foody-pos.co.il

  if (parts.length >= minParts && !skipSubdomains.includes(parts[0])) {
    const slug = parts[0];

    // Don't rewrite API routes, static files, or already-rewritten /r/ paths
    if (
      pathname.startsWith('/r/') ||
      pathname.startsWith('/api/') ||
      pathname.startsWith('/_next/') ||
      pathname === '/favicon.ico' ||
      pathname === '/sw.js'
    ) {
      return NextResponse.next();
    }

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

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo|sw.js).*)'],
};
