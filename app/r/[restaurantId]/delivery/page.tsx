import { fetchMenu, fetchRestaurant } from "@/services/api";
import { OrderExperience } from "@/components/OrderExperience";
import { notFound, redirect } from "next/navigation";

type PageProps = {
  params: { restaurantId: string };
};

export default async function DeliveryPage({ params }: PageProps) {
  try {
    const [restaurant, menu] = await Promise.all([
      fetchRestaurant(params.restaurantId),
      fetchMenu(params.restaurantId),
    ]);
    
    // Check if delivery is enabled
    if (!restaurant.deliveryEnabled) {
      redirect(`/r/${params.restaurantId}`);
    }

    return (
      <OrderExperience
        menu={menu}
        restaurant={restaurant}
        orderType="delivery"
      />
    );
  } catch (error) {
    notFound();
  }
}
