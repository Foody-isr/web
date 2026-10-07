/** Preserve visual context across a hosted payment redirect in this browser tab. */
export function rememberOrderPage(restaurantId: string, orderId: string, pageSlug: string): void {
  if (!pageSlug) return;
  try {
    sessionStorage.setItem(`foody-order-page:${restaurantId}:${orderId}`, pageSlug);
  } catch {
    // Optional presentation state must never prevent an order's payment.
  }
}

/** Read only this restaurant/order's page; unavailable storage uses the site default. */
export function recalledOrderPage(restaurantId: string, orderId: string): string | null {
  try {
    return sessionStorage.getItem(`foody-order-page:${restaurantId}:${orderId}`);
  } catch {
    return null;
  }
}
