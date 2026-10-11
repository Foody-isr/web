"use client";

import { CheckoutFlow } from "../checkout/CheckoutFlow";

/** Cart review shares fulfillment, pricing and availability with checkout. */
export default function CartPage() {
  return <CheckoutFlow reviewCart />;
}
