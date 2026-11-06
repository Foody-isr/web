import type {
  LoyaltyWalletAssertion,
  LoyaltyWalletCapabilities,
} from "./types";

/** Independent build opt-in; the program UI must also be enabled. */
export const loyaltyWalletEnabled =
  process.env.NEXT_PUBLIC_LOYALTY_WALLET_ENABLED === "true";

const uuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v) &&
  v !== "00000000-0000-0000-0000-000000000000";
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) =>
  Object.keys(v).length === keys.length &&
  keys.every((key) => Object.hasOwn(v, key));
const invalid = (): never => {
  throw new Error("wallet_invalid_response");
};

/** Only the three owned actions may use the JSON customer gateway. */
export function walletCustomerAction(
  method: string,
  path: string,
): "read" | "google" | "revoke" | null {
  if (method === "GET" && path === "loyalty/wallet") return "read";
  if (method !== "POST") return null;
  if (path === "loyalty/wallet/cards/google") return "google";
  const match =
    /^loyalty\/wallet\/cards\/(apple|google)\/([^/]+)\/revoke$/.exec(path);
  return match && uuid(match[2]) ? "revoke" : null;
}

/** Require the same explicit 32-bit restaurant scope as the Go adapter. */
export function walletRestaurant(value: unknown): number | null {
  return typeof value === "string" &&
    /^[1-9]\d{0,9}$/.test(value) &&
    Number(value) <= 0xffffffff
    ? Number(value)
    : null;
}

/** Assertions detect an old programme view and never authenticate the account. */
export function checkedWalletAssertion(value: unknown): LoyaltyWalletAssertion {
  if (
    !object(value) ||
    !exact(value, ["membership_id", "program_id"]) ||
    !uuid(value.membership_id) ||
    !uuid(value.program_id)
  )
    return invalid();
  return { membership_id: value.membership_id, program_id: value.program_id };
}

/** Reject unknown fields, duplicate active platforms and incoherent metadata. */
export function checkedWalletCapabilities(
  value: unknown,
): LoyaltyWalletCapabilities {
  if (
    !object(value) ||
    !exact(value, [
      "membership_id",
      "program_id",
      "apple",
      "google",
      "cards",
    ]) ||
    !uuid(value.membership_id) ||
    !uuid(value.program_id) ||
    typeof value.apple !== "boolean" ||
    typeof value.google !== "boolean" ||
    !Array.isArray(value.cards) ||
    value.cards.length > 2
  )
    return invalid();
  const platforms = new Set<string>();
  const ids = new Set<string>();
  for (const card of value.cards) {
    if (
      !object(card) ||
      !exact(card, ["id", "platform", "status", "updated_at", "pending"]) ||
      !uuid(card.id) ||
      (card.platform !== "apple" && card.platform !== "google") ||
      platforms.has(card.platform) ||
      ids.has(card.id) ||
      card.status !== "active" ||
      typeof card.pending !== "boolean" ||
      typeof card.updated_at !== "string" ||
      !/^\d{4}-\d\d-\d\dT/.test(card.updated_at) ||
      !Number.isFinite(Date.parse(card.updated_at))
    )
      return invalid();
    platforms.add(card.platform);
    ids.add(card.id);
  }
  return value as unknown as LoyaltyWalletCapabilities;
}

/** Only a short Google reference URL may leave the owned creation protocol. */
export function checkedGoogleWalletURL(value: unknown): string {
  if (
    !object(value) ||
    !exact(value, ["save_url"]) ||
    typeof value.save_url !== "string" ||
    value.save_url.length > 1900
  )
    return invalid();
  const u = new URL(value.save_url);
  const jwt = u.pathname.slice("/gp/v/save/".length);
  if (
    u.protocol !== "https:" ||
    u.hostname !== "pay.google.com" ||
    u.port ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    !/^\/gp\/v\/save\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(
      u.pathname,
    ) ||
    jwt.length > 1800
  )
    return invalid();
  return u.href;
}

/** A form can return only to this restaurant's known loyalty route. */
export function walletReturnPath(rid: number, path: unknown): string | null {
  return path === "/account/loyalty" || path === `/r/${rid}/account/loyalty`
    ? path
    : null;
}
