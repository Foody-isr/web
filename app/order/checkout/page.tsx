import { CheckoutFlow } from "./CheckoutFlow";
import { OrderThemeBoundary, type OrderThemeSearchParams } from "@/components/OrderThemeBoundary";

/** Customer details, verification and payment flow. */
export default async function CheckoutPage({ searchParams }: { searchParams: Promise<OrderThemeSearchParams> }) {
  return <OrderThemeBoundary searchParams={await searchParams} enableCartOverlay><CheckoutFlow /></OrderThemeBoundary>;
}
