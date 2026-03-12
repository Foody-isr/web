import { fetchRestaurant } from "@/services/api";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const restaurant = await fetchRestaurant(params.slug);
    if (restaurant.logoUrl) {
      return NextResponse.redirect(restaurant.logoUrl);
    }
  } catch {
    // Fall through to default
  }
  // Fallback to default Foody logo
  return NextResponse.redirect(new URL("/logo.svg", request.url));
}
