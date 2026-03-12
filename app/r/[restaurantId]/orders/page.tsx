import { fetchRestaurant } from "@/services/api";
import { notFound } from "next/navigation";
import { OrderHistoryContent } from "./OrderHistoryContent";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { restaurantId: string };
};

export default async function Page({ params }: PageProps) {
  try {
    const restaurant = await fetchRestaurant(params.restaurantId);
    return (
      <OrderHistoryContent
        restaurantId={String(restaurant.id)}
        restaurantSlug={restaurant.slug || params.restaurantId}
        restaurantName={restaurant.name}
        restaurantLogoUrl={restaurant.logoUrl}
      />
    );
  } catch {
    notFound();
  }
}
