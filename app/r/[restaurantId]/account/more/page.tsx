import { notFound } from "next/navigation";
import { MobileMoreContent } from "@/components/website-v3/MobileExperience";
import { readMobileExperience } from "@/lib/mobileExperience";
import { getWebsiteV3SiteContext } from "@/lib/websiteV3PageContext";
import { PublishedMobileTab } from "@/components/mobile-experience/PublishedMobileTab";
import type { WebsitePageSearchParams } from "@/lib/websiteV3Rendering";

/** Renders the published utility page for the current restaurant. */
export default async function MorePage({ params, searchParams }: {
  params: Promise<{ restaurantId: string }>;
  searchParams?: Promise<WebsitePageSearchParams>;
}) {
  const { restaurantId } = await params;
  const { restaurant } = await getWebsiteV3SiteContext(restaurantId, false).catch(() => notFound());
  if (!restaurant || !readMobileExperience(restaurant.websiteConfig?.navLayout?.mobile_experience)?.navigation.enabled) notFound();
  return (
    <PublishedMobileTab searchParams={await searchParams}>
      <MobileMoreContent restaurant={restaurant} siteConfig={restaurant.websiteConfig ?? null} />
    </PublishedMobileTab>
  );
}
