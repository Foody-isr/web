import { CateringRoutePage } from "@/components/website-v3/CateringRoutePage";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { restaurantId: string; serviceSlug: string; itemSlug: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

/** Opens one catering formula in the existing detail drawer at a shareable URL. */
export default function CateringItemPage({ params, searchParams }: PageProps) {
  return (
    <CateringRoutePage
      restaurantId={params.restaurantId}
      serviceSlug={params.serviceSlug}
      itemSlug={params.itemSlug}
      searchParams={searchParams}
    />
  );
}
