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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const restaurantName = searchParams.get("name") || "Foody";
  const logoUrl = searchParams.get("logo");
  const coverUrl = searchParams.get("cover");
  const bg = searchParams.get("bg");

  const cacheHeaders = {
    "Cache-Control":
      "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
  };

  if (logoUrl) {
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
            src={logoUrl}
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

  if (coverUrl) {
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
            src={coverUrl}
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

  const backgroundColor = bg && /^#[0-9a-fA-F]{6}$/.test(bg)
    ? bg
    : colorFromName(restaurantName);

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
