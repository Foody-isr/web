import { fetchRestaurant } from "@/services/api";
import { SectionRenderer } from "@/components/sections/SectionRenderer";
import { SiteFooter } from "@/components/SiteFooter";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

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
};

export default async function DynamicPage({ params }: PageProps) {
  if (RESERVED.has(params.page)) {
    notFound();
  }

  try {
    const restaurant = await fetchRestaurant(params.restaurantId);
    const slug = restaurant.slug || String(restaurant.id);

    // Filter sections for this page
    const pageSections = (restaurant.websiteSections || []).filter(
      (s) => s.page === params.page
    );

    // A page is valid if it's declared in the pages config OR has sections.
    // Declared-but-empty pages render with an empty state instead of 404 so a
    // freshly-created page is reachable while the owner fills it in.
    const pageMeta = (restaurant.websiteConfig?.pages || []).find(
      (p) => p.slug === params.page
    );
    if (!pageMeta && pageSections.length === 0) {
      notFound();
    }

    const pageTitle =
      pageMeta?.label || params.page.charAt(0).toUpperCase() + params.page.slice(1);

    return (
      <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text)]">
        {/* Nav Bar */}
        <nav className="sticky top-0 z-40 bg-[var(--surface)]/95 backdrop-blur-md border-b border-[var(--divider)]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href={`/r/${slug}`} className="flex items-center gap-3">
                {restaurant.logoUrl && (
                  <Image
                    src={restaurant.logoUrl}
                    alt={restaurant.name}
                    width={40}
                    height={40}
                    className="rounded-full object-cover"
                  />
                )}
                <span className="font-bold text-lg">{restaurant.name}</span>
              </Link>
            </div>
            <Link
              href={`/r/${slug}/order`}
              className="px-5 py-2.5 rounded-full bg-brand text-white font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              Order Now
            </Link>
          </div>
        </nav>

        {/* Page Title */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <h1 className="text-3xl font-bold">{pageTitle}</h1>
        </div>

        {/* Sections */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {pageSections.length > 0 ? (
            <SectionRenderer sections={pageSections} restaurant={restaurant} />
          ) : (
            <p className="py-16 text-center text-[var(--text-soft)]">
              Cette page n&apos;a pas encore de contenu.
            </p>
          )}
        </div>

        {/* Site-wide footer */}
        <div className="mt-16">
          <SiteFooter restaurant={restaurant} />
        </div>
      </div>
    );
  } catch {
    notFound();
  }
}
