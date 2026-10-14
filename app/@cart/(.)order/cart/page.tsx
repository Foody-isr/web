import { CartOverlay } from "@/components/CartOverlay";
import { OrderThemeBoundary, type OrderThemeSearchParams } from "@/components/OrderThemeBoundary";

/** Keep the current restaurant page mounted while reviewing its cart. */
export default async function InterceptedCartPage({ searchParams }: { searchParams: Promise<OrderThemeSearchParams> }) {
  return <OrderThemeBoundary searchParams={await searchParams}><CartOverlay /></OrderThemeBoundary>;
}
