import { fetchOrder } from "@/services/api";
import { OrderTrackingClient } from "@/components/OrderTrackingClient";

type PageProps = {
  params: { orderId: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function Page({ params, searchParams }: PageProps) {
  const restaurantId =
    typeof searchParams?.restaurantId === "string" ? (searchParams?.restaurantId as string) : "";
  const tableId = typeof searchParams?.tableId === "string" ? searchParams?.tableId : undefined;

  if (!restaurantId) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="p-6 rounded-lg border shadow-sm text-center space-y-2">
          <h1 className="text-xl font-semibold">Missing restaurant</h1>
          <p className="text-slate-600">
            The tracking URL needs ?restaurantId=&lt;id&gt; to fetch status.
          </p>
        </div>
      </main>
    );
  }

  const order = await fetchOrder(params.orderId, restaurantId);

  return (
    <OrderTrackingClient
      order={order}
      orderId={params.orderId}
      restaurantId={restaurantId}
      tableId={tableId}
      menuHref={tableId ? `/order/${restaurantId}/${tableId}` : undefined}
    />
  );
}
