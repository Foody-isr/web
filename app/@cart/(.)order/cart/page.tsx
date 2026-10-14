import { CartOverlay } from "@/components/CartOverlay";
import { OrderThemeBridge } from "@/app/order/OrderThemeBridge";

/** Keep the current restaurant page mounted while reviewing its cart. */
export default function InterceptedCartPage() {
  return <OrderThemeBridge><CartOverlay /></OrderThemeBridge>;
}
