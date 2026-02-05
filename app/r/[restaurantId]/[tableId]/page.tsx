import { fetchMenu, fetchRestaurant } from "@/services/api";
import { OrderExperience } from "@/components/OrderExperience";
import { notFound } from "next/navigation";

type PageProps = {
  params: { restaurantId: string; tableId: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function Page({ params, searchParams }: PageProps) {
  try {
    const [restaurant, menu] = await Promise.all([
      fetchRestaurant(params.restaurantId),
      fetchMenu(params.restaurantId),
    ]);
    
    const sessionId =
      typeof searchParams?.sessionId === "string" ? (searchParams?.sessionId as string) : undefined;
    
    return (
      <OrderExperience
        menu={menu}
        restaurant={restaurant}
        orderType="dine_in"
        tableId={params.tableId}
        sessionId={sessionId}
      />
    );
  } catch (error) {
    notFound();
  }
}
