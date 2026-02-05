import { fetchMenu, fetchRestaurant } from "@/services/api";
import { OrderExperience } from "@/components/OrderExperience";
import { notFound, redirect } from "next/navigation";

type PageProps = {
  params: { restaurantId: string };
};

export default async function PickupPage({ params }: PageProps) {
  try {
    const [restaurant, menu] = await Promise.all([
      fetchRestaurant(params.restaurantId),
      fetchMenu(params.restaurantId),
    ]);
    
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
