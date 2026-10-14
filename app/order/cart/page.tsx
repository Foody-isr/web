import { CheckoutFlow } from "../checkout/CheckoutFlow";
import { OrderThemeBoundary, type OrderThemeSearchParams } from "@/components/OrderThemeBoundary";

/** Cart review shares fulfillment, pricing and availability with checkout. */
export default async function CartPage({ searchParams }: { searchParams: Promise<OrderThemeSearchParams> }) {
  return <OrderThemeBoundary searchParams={await searchParams}><CheckoutFlow reviewCart /></OrderThemeBoundary>;
}
