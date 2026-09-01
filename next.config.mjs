/** @type {import('next').NextConfig} */
const nextConfig = {
  // NOTE: do NOT add a `redirects()` entry for `source: "/"` here.
  // next.config redirects run BEFORE middleware, so they fire on every host
  // this deployment serves — including restaurant custom domains such as
  // mamietlv.co.il — before middleware can rewrite `/` to `/r/{slug}`.
  // The marketing-site redirect for the Foody app root lives in middleware.ts,
  // where the host is known.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**"
      }
    ]
  }
};

export default nextConfig;
