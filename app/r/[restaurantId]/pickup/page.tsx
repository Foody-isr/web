import { redirect } from "next/navigation";

type PageProps = {
  params: { restaurantId: string };
};

/**
 * Legacy pickup route - redirects to the main restaurant page.
 * Order type selection is now handled within the OrderExperience UI.
 */
export default async function PickupPage({ params }: PageProps) {
  redirect(`/r/${params.restaurantId}`);
}
