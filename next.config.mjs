/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), usb=()" },
  {
    key: "Content-Security-Policy",
    value: "base-uri 'self'; object-src 'none'; frame-ancestors https://admin.foody-pos.co.il https://dev-admin.foody-pos.co.il http://localhost:3003",
  },
];

const nextConfig = {
  // NOTE: do NOT add a `redirects()` entry for `source: "/"` here.
  // next.config redirects run BEFORE middleware, so they fire on every host
  // this deployment serves — including restaurant custom domains such as
  // mamietlv.co.il — before middleware can rewrite `/` to `/r/{slug}`.
  // The marketing-site redirect for the Foody app root lives in middleware.ts,
  // where the host is known.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    // Restaurant-controlled image URLs must be fetched by the browser, not by
    // the Next.js server, so a crafted URL cannot turn image optimisation into
    // an SSRF primitive against internal infrastructure.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**"
      }
    ]
  }
};

export default nextConfig;
