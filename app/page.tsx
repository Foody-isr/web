import Link from "next/link";
import { DevRestaurantSelector } from "@/components/DevRestaurantSelector";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-xl space-y-6 card p-8">
        <p className="text-xs uppercase tracking-[0.35em] text-ink-muted font-semibold">
          Foody QR Ordering
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold">
          Scan a table QR to open{" "}
          <span className="text-brand">/r/&lt;restaurantId&gt;/&lt;tableId&gt;</span>
        </h1>
        <p className="text-ink-muted">
          This web app is the customer-facing experience. Deploy to Vercel and
          point your QR codes here to let guests browse the menu, add items, and
          submit orders from their seat.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/r/demo-restaurant/7"
            className="px-5 py-3 rounded-button bg-brand text-white font-bold shadow-lg shadow-brand/30 hover:bg-brand-dark transition"
          >
            Try sample table
          </Link>
          <Link
            href="https://nextjs.org/docs"
            className="px-4 py-3 rounded-button border border-light-divider text-ink-muted hover:border-brand hover:text-ink transition bg-light-surface"
          >
            Next.js docs
          </Link>
        </div>
        <DevRestaurantSelector />
      </div>
    </main>
  );
}
