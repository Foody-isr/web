import { fetchRestaurant } from "@/services/api";
import { CustomPageClient } from "@/components/CustomPageClient";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/** Reserved slugs that are handled by static routes — never render as a page. */
const RESERVED = new Set([
  "order",
  "orders",
  "table",
  "payment",
  "pickup",
  "delivery",
  "t",
]);

type PageProps = {
  params: { restaurantId: string; page: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

export default async function DynamicPage({ params, searchParams }: PageProps) {
  if (RESERVED.has(params.page)) {
    notFound();
  }

  // Inside the foodyadmin builder the page is loaded with ?preview=1 and the
  // real content arrives over postMessage. A freshly-created page may not be
  // published yet (no meta, no sections in the live data), so we must NOT 404
  // in preview — render the client shell and let the draft populate it.
  const isPreview = searchParams?.preview !== undefined;

  try {
    const restaurant = await fetchRestaurant(params.restaurantId);

    // Filter sections for this page (live data — preview overrides client-side).
    const pageSections = (restaurant.websiteSections || []).filter(
      (s) => s.page === params.page
    );

    // A page is valid if it's declared in the pages config OR has sections.
    // Declared-but-empty pages render with an empty state instead of 404 so a
    // freshly-created page is reachable while the owner fills it in.
    const pageMeta = (restaurant.websiteConfig?.pages || []).find(
      (p) => p.slug === params.page
    );
    if (!pageMeta && pageSections.length === 0 && !isPreview) {
      notFound();
    }

    const pageTitle =
      pageMeta?.label || params.page.charAt(0).toUpperCase() + params.page.slice(1);

    return (
      <CustomPageClient
        restaurant={restaurant}
        pageSlug={params.page}
        pageTitle={pageTitle}
      />
    );
  } catch {
    notFound();
  }
}
