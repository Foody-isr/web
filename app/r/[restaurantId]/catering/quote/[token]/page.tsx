import { fetchCateringQuote } from "@/services/api";
import { CateringQuoteView } from "@/components/CateringQuoteView";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { restaurantId: string; token: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

/**
 * Shareable, read-only view of a submitted catering quote.
 * Reached via /r/<slug>/catering/quote/<token>. Themed by the parent
 * restaurant layout; renders the 404 page if the token is invalid/expired.
 *
 * `restaurantId` in the route may be a slug (custom domains) rather than a
 * numeric id, but the deposit endpoint resolves the restaurant from the
 * quote token, not this value — it's only sent as a query param, so a
 * non-numeric slug safely falls back to 0.
 */
export default async function CateringQuotePage({ params, searchParams }: PageProps) {
  try {
    const quote = await fetchCateringQuote(params.token);
    const restaurantId = Number(params.restaurantId) || 0;
    const depositBanner =
      searchParams?.deposit === "success" ? "success" : searchParams?.deposit === "failed" ? "failed" : undefined;
    return (
      <main className="min-h-screen bg-[var(--bg)] px-4 py-10 text-[var(--text)]">
        <div className="mx-auto max-w-2xl rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-5 shadow-sm sm:p-7">
          <CateringQuoteView quote={quote} restaurantId={restaurantId} depositBanner={depositBanner} />
        </div>
      </main>
    );
  } catch {
    notFound();
  }
}
