import { loyaltyWalletEnabled, walletCustomerAction } from "./loyalty-wallet";
import {
  isLoyaltyCheckoutPath,
  loyaltyCheckoutEnabled,
} from "./loyalty-checkout";
import { loyaltyWebEnabled } from "./loyalty";

const ALLOWED_CUSTOMER_API_ROUTES: ReadonlyArray<{
  method: string;
  pattern: RegExp;
}> = [
  { method: "GET", pattern: /^me\/orders$/ },
  { method: "GET", pattern: /^me\/checkout-profile$/ },
  { method: "PUT", pattern: /^me\/checkout-profile$/ },
  { method: "GET", pattern: /^restaurants\/[a-zA-Z0-9_-]+$/ },
  { method: "GET", pattern: /^payment-methods$/ },
  { method: "GET", pattern: /^payment-capabilities$/ },
  { method: "GET", pattern: /^payment-methods\/capture-key$/ },
  { method: "POST", pattern: /^orders$/ },
  { method: "POST", pattern: /^orders\/\d+\/payment\/init$/ },
  { method: "POST", pattern: /^orders\/\d+\/payment\/saved-method$/ },
  { method: "POST", pattern: /^orders\/\d+\/payment\/signup\/confirm$/ },
  { method: "POST", pattern: /^orders\/\d+\/payment\/encrypted-card$/ },
  { method: "POST", pattern: /^orders\/\d+\/payment\/cibus$/ },
  { method: "DELETE", pattern: /^payment-methods\/\d+$/ },
  { method: "POST", pattern: /^ai\/order-chat$/ },
  { method: "POST", pattern: /^catering\/quotes$/ },
  {
    method: "POST",
    pattern: /^catering\/quotes\/cq_[a-f0-9]{32}\/deposit$/,
  },
];

/** Returns an allowlisted backend-relative path, never an arbitrary URL. */
export function resolveCustomerAPIPath(
  method: string,
  segments: readonly string[],
  loyaltyEnabled = loyaltyWebEnabled,
  checkoutEnabled = loyaltyCheckoutEnabled,
  walletEnabled = loyaltyWalletEnabled,
): string | null {
  if (
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    return null;
  }
  let path: string;
  try {
    path = segments.map((segment) => decodeURIComponent(segment)).join("/");
  } catch {
    return null;
  }
  if (
    loyaltyEnabled &&
    walletEnabled &&
    walletCustomerAction(method.toUpperCase(), path)
  )
    return path;
  if (
    loyaltyEnabled &&
    checkoutEnabled &&
    isLoyaltyCheckoutPath(path) &&
    (path === "loyalty/checkouts" || path.endsWith("/cancel")
      ? method.toUpperCase() === "POST"
      : method.toUpperCase() === "GET")
  )
    return path;
  if (
    loyaltyEnabled &&
    ((["loyalty/program", "me/loyalty-rewards"].includes(path) &&
      method.toUpperCase() === "GET") ||
      (path === "me/loyalty-membership" &&
        ["GET", "POST"].includes(method.toUpperCase())))
  )
    return path;
  return ALLOWED_CUSTOMER_API_ROUTES.some(
    (route) =>
      route.method === method.toUpperCase() && route.pattern.test(path),
  )
    ? path
    : null;
}
