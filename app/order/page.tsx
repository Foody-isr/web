import { redirect } from "next/navigation";

export default function OrderEntry({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const restaurantId = typeof searchParams?.restaurantId === "string" ? searchParams.restaurantId : "";
  const tableId = typeof searchParams?.tableId === "string" ? searchParams.tableId : "";
  const sessionId = typeof searchParams?.sessionId === "string" ? searchParams.sessionId : "";

  if (restaurantId && tableId) {
    const suffix = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
    redirect(`/order/${restaurantId}/${tableId}${suffix}`);
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="card p-6 space-y-2 max-w-md text-center">
        <h1 className="text-xl font-bold">QR link missing info</h1>
        <p className="text-ink-muted">Scan a valid table QR or include restaurantId and tableId.</p>
      </div>
    </main>
  );
}
