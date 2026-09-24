import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ restaurantId: string }>;
};

/**
 * Legacy pickup route - redirects to the main restaurant page.
 * Order type selection is now handled within the OrderExperience UI.
 */
export default async function PickupPage(props: PageProps) {
  const params = await props.params;
  redirect(`/r/${params.restaurantId}/order`);
}
