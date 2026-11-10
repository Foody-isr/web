import { headers } from "next/headers";
import { fetchRestaurant } from "@/services/api";
import { PublishedMobileTab } from "@/components/mobile-experience/PublishedMobileTab";
import {
  LoyaltyCustomerContent,
  LoyaltyUnavailable,
} from "@/components/LoyaltyCustomerContent";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

/** A separate account namespace preserves merchant-authored single-page slugs. */
export default async function LoyaltyPage({
  params,
  searchParams,
}: {
  params: Promise<{ restaurantId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  if (
    Object.hasOwn(query, "preview") ||
    (await headers()).get("sec-fetch-dest") === "iframe"
  )
    return <LoyaltyUnavailable />;
  const { restaurantId } = await params;
  // Rendering failures are real errors, not an invented empty program.
  const restaurant = await fetchRestaurant(restaurantId);
  return (
    <PublishedMobileTab searchParams={query}>
      <LoyaltyCustomerContent restaurant={restaurant} />
    </PublishedMobileTab>
  );
}
