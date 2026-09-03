import { CateringRoutePage } from "@/components/website-v3/CateringRoutePage";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { restaurantId: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

/** Renders the published default catering page at its canonical public alias. */
export default async function CateringPage({ params, searchParams }: PageProps) {
  return <CateringRoutePage restaurantId={params.restaurantId} searchParams={searchParams} />;
}
