import { fetchRestaurant, fetchCateringServices } from "@/services/api";
import { CateringExperience } from "@/components/CateringExperience";
import { fetchWebsitePages, pageSettingsForType, filterByIds } from "@/lib/websiteV2Api";
import { PageAppearanceScope } from "@/components/PageAppearanceScope";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = { params: { restaurantId: string } };

/**
 * Catering shop landing — service selection, quote configurator, and result.
 * Reached via /r/<slug>/catering.
 */
export default async function CateringPage({ params }: PageProps) {
  try {
    const restaurant = await fetchRestaurant(params.restaurantId);
    const services = await fetchCateringServices(String(restaurant.id));
    // v2: a catering page can connect to a subset of services (Réglages →
    // Contenu commercial). Empty selection = all.
    const pages = await fetchWebsitePages(params.restaurantId);
    const settings = pageSettingsForType(pages, "catering");
    const shown = filterByIds(services, settings.service_ids);
    return (
      <PageAppearanceScope appearance={settings.appearance}>
        <CateringExperience restaurant={restaurant} services={shown} />
      </PageAppearanceScope>
    );
  } catch {
    notFound();
  }
}
