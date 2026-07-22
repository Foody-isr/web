import { fetchRestaurant, fetchCateringServices } from "@/services/api";
import { CateringExperience } from "@/components/CateringExperience";
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
    return <CateringExperience restaurant={restaurant} services={services} />;
  } catch {
    notFound();
  }
}
