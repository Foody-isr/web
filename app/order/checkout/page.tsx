import { notFound } from "next/navigation";
import { CheckoutFlow } from "./CheckoutFlow";
import { OrderThemeBoundary, type OrderThemeSearchParams } from "@/components/OrderThemeBoundary";

/** Customer details, verification and payment flow. */
export default async function CheckoutPage({ searchParams }: { searchParams: Promise<OrderThemeSearchParams> }) {
  const params = await searchParams;
  if (params.tourId !== undefined) notFound();
  return <OrderThemeBoundary searchParams={params} enableCartOverlay><CheckoutFlow /></OrderThemeBoundary>;
}
