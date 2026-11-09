import { notFound } from "next/navigation";
import { MobileExperienceSurface } from "@/components/website-v3/MobileExperience";
import { readMobileExperience } from "@/lib/mobileExperience";
import { fetchRestaurant } from "@/services/api";

/** Renders the published utility page for the current restaurant. */
export default async function MorePage({ params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params;
  const restaurant = await fetchRestaurant(restaurantId).catch(() => null);
  if (!restaurant || !readMobileExperience(restaurant.websiteConfig?.navLayout?.mobile_experience)?.navigation.enabled) notFound();
  return <MobileExperienceSurface restaurant={restaurant} surface="more" />;
}
