import { fetchRestaurant } from "@/services/api";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const restaurant = await fetchRestaurant(params.slug);
    const primaryColor = restaurant.websiteConfig?.primaryColor || "#EB5204";

    const manifest = {
      name: restaurant.name,
      short_name: restaurant.name.length > 12 ? restaurant.name.slice(0, 12) : restaurant.name,
      description: restaurant.description || `Order from ${restaurant.name}`,
      start_url: `/r/${restaurant.slug || params.slug}`,
      display: "standalone" as const,
      background_color: "#ffffff",
      theme_color: primaryColor,
      icons: restaurant.logoUrl
        ? [
            { src: restaurant.logoUrl, sizes: "192x192", type: "image/png" },
            { src: restaurant.logoUrl, sizes: "512x512", type: "image/png" },
          ]
        : [],
    };

    return NextResponse.json(manifest, {
      headers: {
        "Content-Type": "application/manifest+json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch {
    return NextResponse.json(
      { name: "Foody", short_name: "Foody", start_url: "/", display: "standalone" },
      { status: 200, headers: { "Content-Type": "application/manifest+json" } }
    );
  }
}
