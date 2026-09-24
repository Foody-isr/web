import { CateringRoutePage } from "@/components/website-v3/CateringRoutePage";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ restaurantId: string; serviceSlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/** Opens one catering service at its canonical public URL. */
export default async function CateringServicePage(props: PageProps) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  return (
    <CateringRoutePage
      restaurantId={params.restaurantId}
      serviceSlug={params.serviceSlug}
      searchParams={searchParams}
    />
  );
}
