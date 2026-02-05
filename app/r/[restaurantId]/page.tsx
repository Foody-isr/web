import { fetchRestaurant } from "@/services/api";
import { RestaurantLanding } from "./RestaurantLanding";
import { notFound } from "next/navigation";

type PageProps = {
  params: { restaurantId: string };
};

export default async function Page({ params }: PageProps) {
  try {
    const restaurant = await fetchRestaurant(params.restaurantId);
    return <RestaurantLanding restaurant={restaurant} />;
  } catch (error) {
    notFound();
  }
}
