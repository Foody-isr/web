import { fetchCateringQuote } from "@/services/api";
import { CateringQuoteView } from "@/components/CateringQuoteView";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = { params: { restaurantId: string; token: string } };

/**
 * Shareable, read-only view of a submitted catering quote.
 * Reached via /r/<slug>/catering/quote/<token>. Themed by the parent
 * restaurant layout; renders the 404 page if the token is invalid/expired.
 */
export default async function CateringQuotePage({ params }: PageProps) {
  try {
    const quote = await fetchCateringQuote(params.token);
    return (
      <main className="min-h-screen bg-[var(--bg)] px-4 py-10 text-[var(--text)]">
        <div className="mx-auto max-w-md rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-6 shadow-sm">
          <CateringQuoteView quote={quote} />
        </div>
      </main>
    );
  } catch {
    notFound();
  }
}
