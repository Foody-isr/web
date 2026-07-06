import { NextRequest } from "next/server";

// Same-origin proxy for restaurant-uploaded custom fonts.
//
// Custom fonts are stored on S3 and loaded via @font-face. Because webfonts are
// CORS-checked (unlike <img>), a cross-origin @font-face to S3 fails unless the
// bucket returns Access-Control-Allow-Origin. Routing the font through this
// route makes it same-origin for the guest page (and CORS-open for the admin
// builder preview), so uploaded fonts render regardless of bucket CORS config.
//
// SSRF-safe: only the app's own upload bucket + font paths + font extensions are
// proxied; everything else is rejected.

const CONTENT_TYPES: Record<string, string> = {
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  otf: "font/otf",
};

// Extra hosts (e.g. a CloudFront/CDN domain) may be allow-listed via env when the
// stored font URLs don't use the default S3 virtual-hosted host.
const EXTRA_HOSTS = (process.env.FONT_PROXY_ALLOWED_HOSTS ?? "")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

/** True when the URL points at a font file in our own upload bucket. */
function isAllowedFontUrl(u: URL): boolean {
  if (u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  const isOurBucket =
    host.endsWith(".amazonaws.com") &&
    (host.startsWith("foody-menu-images.") || u.pathname.startsWith("/foody-menu-images/"));
  if (!isOurBucket && !EXTRA_HOSTS.includes(host)) return false;
  if (!u.pathname.includes("/fonts/")) return false;
  const ext = u.pathname.split(".").pop()?.toLowerCase() ?? "";
  return ext in CONTENT_TYPES;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("u");
  if (!raw) return new Response("missing font url", { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("invalid font url", { status: 400 });
  }
  if (!isAllowedFontUrl(target)) return new Response("forbidden", { status: 403 });

  const ext = target.pathname.split(".").pop()!.toLowerCase();

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), { cache: "no-store" });
  } catch {
    return new Response("upstream fetch failed", { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return new Response("upstream error", { status: 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": CONTENT_TYPES[ext],
      // Immutable: font keys are content-addressed (UUID filenames).
      "Cache-Control": "public, max-age=31536000, immutable",
      // Open CORS so the admin builder preview (different origin) can load it too.
      "Access-Control-Allow-Origin": "*",
    },
  });
}
