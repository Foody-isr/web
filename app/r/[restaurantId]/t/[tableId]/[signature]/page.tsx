import { fetchRestaurant } from "@/services/api";
import { notFound, redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ restaurantId: string; tableId: string; signature: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function QRTablePage(props: PageProps) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  try {
    // The signature in the URL validates the QR code authenticity
    // Fetch restaurant to validate it exists (supports slug or numeric ID)
    await fetchRestaurant(params.restaurantId);

    const sessionId =
      typeof searchParams?.sessionId === "string"
        ? searchParams.sessionId
        : undefined;

    // Redirect to the new standardized table URL format
    const tableUrl = `/r/${params.restaurantId}/table/${params.tableId}${sessionId ? `?sessionId=${sessionId}` : ""}`;
    redirect(tableUrl);
  } catch (error) {
    notFound();
  }
}
