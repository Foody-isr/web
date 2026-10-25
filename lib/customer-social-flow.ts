export type CustomerSocialProvider = "facebook" | "apple";
export type CustomerSocialFlow = { provider: CustomerSocialProvider; state: string; nonce: string; createdAt: number };

/** Validates the browser-bound, short-lived flow before accepting SDK credentials. */
export function validCustomerSocialFlow(flow: unknown, provider: CustomerSocialProvider, state: unknown, now = Date.now()): flow is CustomerSocialFlow {
  if (!flow || typeof flow !== "object") return false;
  const value = flow as Partial<CustomerSocialFlow>;
  return value.provider === provider && typeof state === "string" && /^[a-f0-9]{64}$/.test(state) && value.state === state &&
    typeof value.nonce === "string" && /^[a-f0-9]{64}$/.test(value.nonce) && typeof value.createdAt === "number" &&
    value.createdAt <= now && now - value.createdAt < 10 * 60_000;
}
