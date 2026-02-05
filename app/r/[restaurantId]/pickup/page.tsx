import { fetchMenu, fetchRestaurant } from "@/services/api";
import { OrderExperience } from "@/components/OrderExperience";
import { notFound, redirect } from "next/navigation";

type PageProps = {
  params: { restaurantId: string };
};

export default async function PickupPage({ params }: PageProps) {
  try {
    // First fetch restaurant to get numeric ID, then fetch menu with that ID
    const restaurant = await fetchRestaurant(params.restaurantId);
    const menu = await fetchMenu(String(restaurant.id));
    
    // Check if pickup is enabled
    if (!restaurant.pickupEnabled) {
      redirect(`/r/${params.restaurantId}`);
    }

    return (
      <OrderExperience
        menu={menu}
        restaurant={restaurant}
        orderType="pickup"
      />
    );
  } catch (error) {
    notFound();
  }
}
