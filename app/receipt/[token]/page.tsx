import { fetchReceipt } from "@/services/api";
import { ReceiptClient } from "@/components/ReceiptClient";

type PageProps = {
  params: { token: string };
};

export default async function ReceiptPage({ params }: PageProps) {
  try {
    const receipt = await fetchReceipt(params.token);

    return <ReceiptClient receipt={receipt} />;
  } catch (error) {
    return (
      <main className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="card p-8 text-center max-w-md w-full space-y-4">
          <div className="text-6xl">🔍</div>
          <h1 className="text-xl font-bold">Receipt Not Found</h1>
          <p className="text-ink-muted">
            This receipt link may have expired or is invalid. Please check the link and try again.
          </p>
        </div>
      </main>
    );
  }
}

export const metadata = {
  title: "Receipt | Foody",
  description: "View your order receipt",
};
