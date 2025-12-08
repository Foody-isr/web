import { OrderTrackingClient } from "@/components/OrderTrackingClient";
import { fetchOrder } from "@/services/api";

type PageProps = {
  params: { restaurantId: string; tableId: string; orderId: string };
};

export default async function Page({ params }: PageProps) {
  const order = await fetchOrder(params.orderId, params.restaurantId);
  return (
    <OrderTrackingClient
      order={order}
      restaurantId={params.restaurantId}
      tableId={params.tableId}
      orderId={params.orderId}
      menuHref={`/r/${params.restaurantId}/${params.tableId}`}
      showWsHint
    />
  );
}
