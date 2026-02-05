import { fetchMenu, fetchRestaurant } from "@/services/api";
import { OrderExperience } from "@/components/OrderExperience";
import { notFound } from "next/navigation";

type PageProps = {
  params: { restaurantId: string; tableId: string; signature: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function QRTablePage({ params, searchParams }: PageProps) {
  try {
    // The signature in the URL validates the QR code authenticity
    // Fetch restaurant (supports slug or numeric ID)
    const restaurant = await fetchRestaurant(params.restaurantId);
    const menu = await fetchMenu(String(restaurant.id));
    
    const sessionId =
      typeof searchParams?.sessionId === "string" ? searchParams.sessionId : undefined;
    
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
