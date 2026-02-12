import { fetchOrder, fetchRestaurant } from "@/services/api";
import { OrderTrackingClient } from "@/components/OrderTrackingClient";

type PageProps = {
  params: { orderId: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function Page({ params, searchParams }: PageProps) {
  const restaurantId =
    typeof searchParams?.restaurantId === "string" ? (searchParams?.restaurantId as string) : "";
  const tableId = typeof searchParams?.tableId === "string" ? searchParams?.tableId : undefined;
  const sessionId = typeof searchParams?.sessionId === "string" ? searchParams?.sessionId : undefined;

  if (!restaurantId) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="card p-6 text-center space-y-2">
          <h1 className="text-xl font-bold">Missing restaurant</h1>
          <p className="text-[var(--text-muted)]">
            The tracking URL needs ?restaurantId=&lt;id&gt; to fetch status.
          </p>
        </div>
      </main>
    );
  }

  const order = await fetchOrder(params.orderId, restaurantId);

  // Build proper back-to-table link
  let menuHref: string | undefined;
  if (tableId) {
    try {
      const restaurant = await fetchRestaurant(restaurantId);
      const slug = restaurant.slug || restaurantId;
      menuHref = `/r/${slug}/table/${tableId}${sessionId ? `?sessionId=${sessionId}` : ""}`;
    } catch {
      menuHref = undefined;
    }
  }

  return (
    <OrderTrackingClient
      order={order}
      orderId={params.orderId}
      restaurantId={restaurantId}
      tableId={tableId}
      menuHref={menuHref}
      receiptToken={order.receiptToken}
    />
  );
}
