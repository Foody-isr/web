import { fetchRestaurant } from "@/services/api";
import { notFound } from "next/navigation";
import { OrderHistoryContent } from "./OrderHistoryContent";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ restaurantId: string }>;
};

export default async function Page(props: PageProps) {
  const params = await props.params;
  try {
    const restaurant = await fetchRestaurant(params.restaurantId);
    return <OrderHistoryContent restaurant={restaurant} />;
  } catch {
    notFound();
  }
}
