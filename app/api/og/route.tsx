import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const restaurantName = searchParams.get("name") || "Foody";
  const description = searchParams.get("description") || "Order your favorite food online";
  const logoUrl = searchParams.get("logo");

  // If restaurant has a logo, use it as the full preview image
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
      {
        width: 1200,
        height: 630,
        headers: {
          "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  }

  // Fallback: generic Foody branding when no logo is provided
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#121316",
          backgroundImage: "linear-gradient(135deg, #121316 0%, #202125 50%, #121316 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* Restaurant name */}
        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 700,
            color: "#FFFFFF",
            marginBottom: 20,
            textAlign: "center",
            maxWidth: "80%",
          }}
        >
          {restaurantName}
        </div>

        {/* Description */}
        <div
          style={{
            display: "flex",
            fontSize: 28,
            color: "#9CA3AF",
            textAlign: "center",
            maxWidth: "70%",
            lineHeight: 1.4,
          }}
        >
          {description}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      },
    }
  );
}
