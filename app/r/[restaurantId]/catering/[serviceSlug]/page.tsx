import { CateringRoutePage } from "@/components/website-v3/CateringRoutePage";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { restaurantId: string; serviceSlug: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

/** Opens one catering service at its canonical public URL. */
export default function CateringServicePage({ params, searchParams }: PageProps) {
  return (
    <CateringRoutePage
      restaurantId={params.restaurantId}
      serviceSlug={params.serviceSlug}
      searchParams={searchParams}
    />
  );
}
