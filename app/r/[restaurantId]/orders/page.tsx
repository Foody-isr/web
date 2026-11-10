import { fetchRestaurant } from "@/services/api";
import { notFound } from "next/navigation";
import { PublishedMobileTab } from "@/components/mobile-experience/PublishedMobileTab";
import type { WebsitePageSearchParams } from "@/lib/websiteV3Rendering";
import { OrderHistoryContent } from "./OrderHistoryContent";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ restaurantId: string }>;
  searchParams?: Promise<WebsitePageSearchParams>;
};

export default async function Page(props: PageProps) {
  const params = await props.params;
  try {
    const restaurant = await fetchRestaurant(params.restaurantId);
    return (
      <PublishedMobileTab searchParams={await props.searchParams}>
        <OrderHistoryContent restaurant={restaurant} />
      </PublishedMobileTab>
    );
  } catch {
    notFound();
  }
}
