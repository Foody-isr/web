import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ restaurantId: string }>;
};

/**
 * Legacy delivery route - redirects to the main restaurant page.
 * Order type selection is now handled within the OrderExperience UI.
 */
export default async function DeliveryPage(props: PageProps) {
  const params = await props.params;
  redirect(`/r/${params.restaurantId}/order`);
}
