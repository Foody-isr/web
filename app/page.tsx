import Link from "next/link";
import { DevRestaurantSelector } from "@/components/DevRestaurantSelector";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-xl space-y-6 card p-8">
        <p className="text-xs uppercase tracking-[0.35em] text-[var(--text-muted)] font-semibold">
          Foody QR Ordering
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold">
          Order from{" "}
          <span className="text-brand">/r/&lt;restaurantId&gt;</span>
        </h1>
        <p className="text-[var(--text-muted)]">
          This web app is the customer-facing experience. Share restaurant links for
          online orders (pickup/delivery), or use QR codes for dine-in.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/r/1"
            className="w-full sm:w-auto px-5 py-3 rounded-button bg-brand text-white font-bold shadow-lg shadow-brand/30 hover:bg-brand-dark transition"
          >
            Try Online Ordering
          </Link>
          <Link
            href="/r/1/table/7"
            className="w-full sm:w-auto px-4 py-3 rounded-button border border-[var(--divider)] text-[var(--text-muted)] hover:border-brand hover:text-[var(--text)] transition bg-[var(--surface)]"
          >
            Try Dine-In (Table QR)
          </Link>
        </div>
        <DevRestaurantSelector />
      </div>
    </main>
  );
}
