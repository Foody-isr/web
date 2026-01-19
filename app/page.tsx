import Link from "next/link";
import { DevRestaurantSelector } from "@/components/DevRestaurantSelector";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-xl space-y-6 card p-8 border border-black/5">
        <p className="text-xs uppercase tracking-[0.35em] text-ink/60 font-semibold">
          Foody QR Ordering
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold">
          Scan a table QR to open{" "}
          <span className="text-brand-dark">/r/&lt;restaurantId&gt;/&lt;tableId&gt;</span>
        </h1>
        <p className="text-ink/70">
          This web app is the customer-facing experience. Deploy to Vercel and
          point your QR codes here to let guests browse the menu, add items, and
          submit orders from their seat.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/r/demo-restaurant/table-7"
            className="px-5 py-3 rounded-full bg-brand text-white font-medium shadow-lg shadow-brand/30 hover:bg-brand-dark transition"
          >
            Try sample table
          </Link>
          <Link
            href="https://nextjs.org/docs"
            className="px-4 py-3 rounded-full border border-black/10 text-ink/70 hover:border-brand hover:text-ink transition bg-white/80"
          >
            Next.js docs
          </Link>
        </div>
        <DevRestaurantSelector />
      </div>
    </main>
  );
}
