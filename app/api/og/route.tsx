import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

function colorFromName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  return `hsl(${hue}, 55%, 30%)`;
}

function clampPercent(value: string | null, fallback: number): number {
  if (value == null) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, n));
}

/**
 * Detects whether the leading bytes look like an image format satori can decode.
 * We treat JPEG and PNG as first-class; satori has known issues rendering WebP
 * inside `next/og` so we only accept files where the bytes match these formats.
 */
function detectSatoriCompatibleMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  return null;
}

/**
 * Builds an images.weserv.nl URL that transcodes the source to JPEG. The S3
 * upload pipeline currently stores AVIF/WebP bytes under .png/.jpg names with
 * mismatched content-types; Vercel's image optimizer trusts the content-type
 * and passes the bytes through unchanged, but satori can't decode AVIF and
 * struggles with WebP. weserv re-encodes server-side regardless of source.
 */
function buildProxiedJpegUrl(rawUrl: string, width: number): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    const stripped = `${parsed.host}${parsed.pathname}${parsed.search}`;
    const proxied = new URL("https://images.weserv.nl/");
    proxied.searchParams.set("url", stripped);
    proxied.searchParams.set("w", String(width));
    proxied.searchParams.set("output", "jpg");
    proxied.searchParams.set("q", "80");
    return proxied.toString();
  } catch {
    return null;
  }
}

type FetchOutcome =
  | { ok: true; proxiedUrl: string; mime: string; bytes: number }
  | { ok: false; reason: string };

async function fetchAndVerify(rawUrl: string, width: number): Promise<FetchOutcome> {
  const proxiedUrl = buildProxiedJpegUrl(rawUrl, width);
  if (!proxiedUrl) return { ok: false, reason: "invalid source url" };
  try {
    const res = await fetch(proxiedUrl, { cache: "no-store" });
    if (!res.ok) return { ok: false, reason: `weserv http ${res.status}` };
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const mime = detectSatoriCompatibleMime(bytes);
    if (!mime) {
      return {
        ok: false,
        reason: `unrecognized magic bytes from weserv (len=${bytes.length} ct=${res.headers.get("content-type")})`,
      };
    }
    return { ok: true, proxiedUrl, mime, bytes: bytes.length };
  } catch (err) {
    return { ok: false, reason: `fetch threw: ${(err as Error).message ?? String(err)}` };
  }
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const restaurantName = searchParams.get("name") || "Foody";
  const logoUrl = searchParams.get("logo");
  const coverUrl = searchParams.get("cover");
  const bg = searchParams.get("bg");
  const debug = searchParams.get("debug") === "1";

  const cacheHeaders = {
    "Cache-Control":
      "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
  };

  const trace: unknown[] = [];

  if (logoUrl) {
    const result = await fetchAndVerify(logoUrl, 600);
    trace.push({ stage: "logo", input: logoUrl, result });
    if (result.ok) {
      if (debug) return jsonResponse({ picked: "logo", trace });
      return new ImageResponse(
        (
          <div
            style={{
              height: "100%",
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#FFFFFF",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={result.proxiedUrl}
              alt=""
              width={600}
              height={600}
              style={{ objectFit: "contain" }}
            />
          </div>
        ),
        { width: 1200, height: 630, headers: cacheHeaders }
      );
    }
  }

  if (coverUrl) {
    const result = await fetchAndVerify(coverUrl, 1200);
    trace.push({ stage: "cover", input: coverUrl, result });
    if (result.ok) {
      if (debug) return jsonResponse({ picked: "cover", trace });
      const fx = clampPercent(searchParams.get("fx"), 50);
      const fy = clampPercent(searchParams.get("fy"), 50);
      const horizontal = fx < 34 ? "left" : fx > 66 ? "right" : "center";
      const vertical = fy < 34 ? "top" : fy > 66 ? "bottom" : "center";
      return new ImageResponse(
        (
          <div
            style={{
              height: "100%",
              width: "100%",
              display: "flex",
              position: "relative",
              backgroundColor: "#121316",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={result.proxiedUrl}
              alt=""
              width={1200}
              height={630}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: 1200,
                height: 630,
                objectFit: "cover",
                objectPosition: `${horizontal} ${vertical}`,
              }}
            />
          </div>
        ),
        { width: 1200, height: 630, headers: cacheHeaders }
      );
    }
  }

  const backgroundColor = bg && /^#[0-9a-fA-F]{6}$/.test(bg)
    ? bg
    : colorFromName(restaurantName);

  if (debug) return jsonResponse({ picked: "color-fallback", trace });

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor,
          fontFamily: "sans-serif",
          padding: 80,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 120,
            fontWeight: 800,
            color: "#FFFFFF",
            textAlign: "center",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}
        >
          {restaurantName}
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: cacheHeaders }
  );
}
