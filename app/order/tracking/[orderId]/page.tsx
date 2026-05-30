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

  // Fetch restaurant to get service mode, build menu link, and pull the
  // confirmation-page builder config (if the owner has customised it).
  let menuHref: string | undefined;
  let serviceMode: string | undefined;
  let confirmationConfig: import("@/lib/types").ConfirmationConfig | null = null;
  try {
    const restaurant = await fetchRestaurant(restaurantId);
    serviceMode = restaurant.serviceMode;
    const slug = restaurant.slug || restaurantId;
    if (tableId) {
      menuHref = `/r/${slug}/table/${tableId}${sessionId ? `?sessionId=${sessionId}` : ""}`;
    } else {
      menuHref = `/r/${slug}/order`;
    }
    confirmationConfig = restaurant.websiteConfig?.checkoutConfig?.confirmation ?? null;
  } catch {
    // Non-critical — tracking still works without serviceMode
  }

  return (
    <OrderTrackingClient
      order={order}
      orderId={params.orderId}
      restaurantId={restaurantId}
      tableId={tableId}
      menuHref={menuHref}
      receiptToken={order.receiptToken}
      serviceMode={serviceMode}
      confirmationConfig={confirmationConfig}
    />
  );
}
