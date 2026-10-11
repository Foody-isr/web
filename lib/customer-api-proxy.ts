const ALLOWED_CUSTOMER_API_ROUTES: ReadonlyArray<{
  method: string;
  pattern: RegExp;
}> = [
  { method: "GET", pattern: /^me\/orders$/ },
  { method: "GET", pattern: /^payment-methods$/ },
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
  return ALLOWED_CUSTOMER_API_ROUTES.some(
    (route) =>
      route.method === method.toUpperCase() && route.pattern.test(path),
  )
    ? path
    : null;
}
