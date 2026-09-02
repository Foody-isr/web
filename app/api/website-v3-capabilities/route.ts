import { NextResponse } from "next/server";
import { WEBSITE_V3_PREVIEW_CAPABILITIES } from "@/lib/preview/websiteV3Capabilities";

export const dynamic = "force-dynamic";

/** Exposes the public renderer contract consumed by Foody Admin before editing or publishing. */
export async function GET() {
  return NextResponse.json(WEBSITE_V3_PREVIEW_CAPABILITIES, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
