import { redirect } from "next/navigation";

type PageProps = {
  params: { restaurantId: string };
};

/**
 * Legacy delivery route - redirects to the main restaurant page.
 * Order type selection is now handled within the OrderExperience UI.
 */
export default async function DeliveryPage({ params }: PageProps) {
  redirect(`/r/${params.restaurantId}`);
}
