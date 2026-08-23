import { fetchReceipt, fetchRestaurant } from "@/services/api";
import { ReceiptClient } from "@/components/ReceiptClient";

type PageProps = {
  params: { token: string };
};

export default async function ReceiptPage({ params }: PageProps) {
  try {
    const receipt = await fetchReceipt(params.token);

    // Custom-field answers are stored keyed by field id, so they are unreadable
    // without the restaurant's checkout form. Non-critical: without it the card
    // falls back to humanized ids rather than disappearing.
    let checkoutConfig: import("@/lib/types").CheckoutConfig | null = null;
    try {
      const restaurant = await fetchRestaurant(String(receipt.restaurant.id));
      checkoutConfig = restaurant.websiteConfig?.checkoutConfig ?? null;
    } catch {
      /* receipt still renders */
    }

    return <ReceiptClient receipt={receipt} checkoutConfig={checkoutConfig} />;
  } catch (error) {
    return (
      <main className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center p-4">
        <div className="card p-8 text-center max-w-md w-full space-y-4">
          <div className="text-6xl">🔍</div>
          <h1 className="text-xl font-bold">Receipt Not Found</h1>
          <p className="text-[var(--text-muted)]">
            This receipt link may have expired or is invalid. Please check the link and try again.
          </p>
        </div>
      </main>
    );
  }
}

export const metadata = {
  title: "Receipt",
  description: "View your order receipt",
};
