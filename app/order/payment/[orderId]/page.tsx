import { notFound } from "next/navigation";
import { OrderThemeBoundary, type OrderThemeSearchParams } from "@/components/OrderThemeBoundary";
import { EmbeddedPayment } from "./EmbeddedPayment";

/** Render a themed payment step for an already-created guest order. */
export default async function EmbeddedPaymentPage({ params, searchParams }: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<OrderThemeSearchParams>;
}) {
  const { orderId } = await params;
  const query = await searchParams;
  const { restaurantId, t: token } = query;
  if (!/^\d+$/.test(orderId) || typeof restaurantId !== "string" || !/^\d+$/.test(restaurantId) ||
    typeof token !== "string" || !token || query.preview !== undefined) notFound();
  const pageSlug = typeof query.pageSlug === "string" ? query.pageSlug : "";
  const summary = new URLSearchParams({ restaurantId, t: token });
  for (const key of ["pageSlug", "lang", "loyaltyRequestId"]) {
    const value = query[key];
    if (typeof value === "string" && value) summary.set(key, value);
  }
  return <OrderThemeBoundary searchParams={query}>
    <EmbeddedPayment key={orderId} orderId={orderId} restaurantId={restaurantId} token={token} pageSlug={pageSlug}
      summaryHref={`/order/confirmation/${orderId}?${summary}`} />
  </OrderThemeBoundary>;
}
