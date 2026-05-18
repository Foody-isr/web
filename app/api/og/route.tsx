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

function detectSatoriCompatibleMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return "image/gif";
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

type FetchOutcome =
  | { ok: true; dataUrl: string; mime: string; bytes: number; via: string }
  | { ok: false; reason: string; via: string };

async function fetchOptimizedImage(
  url: string,
  origin: string,
  width: number
): Promise<FetchOutcome> {
  const optimized = new URL("/_next/image", origin);
  optimized.searchParams.set("url", url);
  optimized.searchParams.set("w", String(width));
  optimized.searchParams.set("q", "80");
  try {
    const res = await fetch(optimized.toString(), {
      cache: "no-store",
      headers: { Accept: "image/webp,image/png" },
    });
    if (!res.ok) {
      return { ok: false, reason: `optimizer http ${res.status}`, via: optimized.toString() };
    }
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const mime = detectSatoriCompatibleMime(bytes);
    if (!mime) {
      return {
        ok: false,
        reason: `unrecognized magic bytes (len=${bytes.length} ct=${res.headers.get("content-type")})`,
        via: optimized.toString(),
      };
    }
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return {
      ok: true,
      dataUrl: `data:${mime};base64,${btoa(binary)}`,
      mime,
      bytes: bytes.length,
      via: optimized.toString(),
    };
  } catch (err) {
    return {
      ok: false,
      reason: `fetch threw: ${(err as Error).message ?? String(err)}`,
      via: optimized.toString(),
    };
  }
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(request: NextRequest) {
  const reqUrl = new URL(request.url);
  const { searchParams } = reqUrl;
  const origin = reqUrl.origin;
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
    const result = await fetchOptimizedImage(logoUrl, origin, 600);
    trace.push({ stage: "logo", input: logoUrl, result });
    if (result.ok) {
      if (debug) return jsonResponse({ origin, picked: "logo", trace });
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
              src={result.dataUrl}
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
    const result = await fetchOptimizedImage(coverUrl, origin, 1200);
    trace.push({ stage: "cover", input: coverUrl, result });
    if (result.ok) {
      if (debug) return jsonResponse({ origin, picked: "cover", trace });
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
              src={result.dataUrl}
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

  if (debug) return jsonResponse({ origin, picked: "color-fallback", trace });

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
