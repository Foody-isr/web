import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { fetchAndVerify, colorFromName } from "@/lib/og-render";

export const runtime = "edge";

const cacheHeaders = {
  "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
};

/**
 * Item OG card (1200×630) for a shared menu item.
 *   ?iname=  item name (hero text)
 *   ?rname=  restaurant name (eyebrow)
 *   ?img=    item photo URL (optional; rendered full-bleed when decodable)
 *   ?bg=     #RRGGBB fallback background (optional)
 *
 * When the photo decodes via weserv it is the hero with a dark gradient and the
 * name overlaid. Otherwise we render a text card on the brand/derived color so
 * the preview is never broken.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const itemName = searchParams.get("iname") || "";
  const restaurantName = searchParams.get("rname") || "Foody";
  const img = searchParams.get("img");
  const bg = searchParams.get("bg");

  if (img) {
    const result = await fetchAndVerify(img, 1200);
    if (result.ok) {
      return new ImageResponse(
        (
          <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", backgroundColor: "#121316" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={result.proxiedUrl}
              alt=""
              width={1200}
              height={630}
              style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, objectFit: "cover" }}
            />
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                display: "flex",
                flexDirection: "column",
                padding: "60px 64px",
                background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.0) 100%)",
              }}
            >
              <div style={{ display: "flex", fontSize: 30, fontWeight: 600, color: "rgba(255,255,255,0.85)", marginBottom: 8 }}>
                {restaurantName}
              </div>
              <div style={{ display: "flex", fontSize: 64, fontWeight: 800, color: "#FFFFFF", lineHeight: 1.05, letterSpacing: "-0.02em" }}>
                {itemName}
              </div>
            </div>
          </div>
        ),
        { width: 1200, height: 630, headers: cacheHeaders },
      );
    }
  }

  const backgroundColor = bg && /^#[0-9a-fA-F]{6}$/.test(bg) ? bg : colorFromName(restaurantName);
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          alignItems: "flex-start",
          justifyContent: "center",
          backgroundColor,
          fontFamily: "sans-serif",
          padding: 80,
        }}
      >
        <div style={{ display: "flex", fontSize: 32, fontWeight: 600, color: "rgba(255,255,255,0.8)", marginBottom: 16 }}>
          {restaurantName}
        </div>
        <div style={{ display: "flex", fontSize: 96, fontWeight: 800, color: "#FFFFFF", lineHeight: 1.05, letterSpacing: "-0.02em" }}>
          {itemName}
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: cacheHeaders },
  );
}
