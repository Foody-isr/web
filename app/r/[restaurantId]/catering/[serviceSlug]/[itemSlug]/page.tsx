import { CateringRoutePage } from "@/components/website-v3/CateringRoutePage";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    restaurantId: string;
    serviceSlug: string;
    itemSlug: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/** Opens one catering formula in the existing detail drawer at a shareable URL. */
export default async function CateringItemPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  return (
    <CateringRoutePage
      restaurantId={params.restaurantId}
      serviceSlug={params.serviceSlug}
      itemSlug={params.itemSlug}
      searchParams={searchParams}
    />
  );
}
