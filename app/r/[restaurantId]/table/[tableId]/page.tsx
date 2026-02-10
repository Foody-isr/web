import { fetchMenu, fetchRestaurant } from "@/services/api";
import { OrderExperience } from "@/components/OrderExperience";
import { notFound } from "next/navigation";

type PageProps = {
  params: { restaurantId: string; tableId: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function Page({ params, searchParams }: PageProps) {
  try {
    // First fetch restaurant to get numeric ID, then fetch menu with that ID
    const restaurant = await fetchRestaurant(params.restaurantId);
    const menu = await fetchMenu(String(restaurant.id));
    
    const sessionId =
      typeof searchParams?.sessionId === "string" ? (searchParams?.sessionId as string) : undefined;
    
    return (
      <OrderExperience
        menu={menu}
        restaurant={restaurant}
        initialOrderType="dine_in"
        tableId={params.tableId}
        sessionId={sessionId}
      />
    );
  } catch (error) {
    notFound();
  }
}
