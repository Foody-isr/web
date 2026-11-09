import { fetchRestaurant } from "@/services/api";
import { notFound } from "next/navigation";
import { OrderHistoryContent } from "./OrderHistoryContent";
import { MobileExperienceSurface } from "@/components/website-v3/MobileExperience";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ restaurantId: string }>;
};

export default async function Page(props: PageProps) {
  const params = await props.params;
  try {
    const restaurant = await fetchRestaurant(params.restaurantId);
    return <MobileExperienceSurface restaurant={restaurant} surface="orders"><OrderHistoryContent restaurant={restaurant} /></MobileExperienceSurface>;
  } catch {
    notFound();
  }
}
