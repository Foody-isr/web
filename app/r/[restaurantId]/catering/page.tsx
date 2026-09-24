import { CateringRoutePage } from "@/components/website-v3/CateringRoutePage";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ restaurantId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/** Renders the published default catering page at its canonical public alias. */
export default async function CateringPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  return (
    <CateringRoutePage
      restaurantId={params.restaurantId}
      searchParams={searchParams}
    />
  );
}
