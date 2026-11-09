import { isLoyaltyCheckoutPath } from "./loyalty-checkout";
import type {
  LoyaltyEnrollmentInput,
  LoyaltyMembershipSnapshot,
  LoyaltyProgram,
  LoyaltyRules,
  LoyaltyRewardsPage,
} from "./types";

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const integer = (v: unknown, min = 0) =>
  Number.isSafeInteger(v) && Number(v) >= min;
const text = (v: unknown, max: number, multiline = false): v is string =>
  typeof v === "string" &&
  !!v &&
  v === v.trim() &&
  Array.from(v).length <= max &&
  !(multiline ? /[\x00-\x08\x0b-\x1f\x7f-\x9f]/ : /[\x00-\x1f\x7f-\x9f]/).test(
    v,
  );
const date = (v: unknown) =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}T/.test(v) &&
  Number.isFinite(Date.parse(v));
const fail = (): never => {
  throw new Error("loyalty_invalid_response");
};

function rules(value: unknown): LoyaltyRules {
  if (
    !object(value) ||
    !["ILS", "EUR", "USD", "GBP"].includes(String(value.currency)) ||
    !integer(value.minimum_purchase_minor) ||
    !integer(value.reward_threshold, 1) ||
    !integer(value.reward_validity_days) ||
    Number(value.reward_validity_days) > 3650 ||
    !text(value.terms_version, 80)
  )
    return fail();
  if (
    value.mode === "points"
      ? !integer(value.spend_step_minor, 1) || !integer(value.units_per_step, 1)
      : value.mode !== "visits" ||
        value.spend_step_minor !== 0 ||
        value.units_per_step !== 1
  )
    return fail();
  if (
    value.reward_type === "fixed"
      ? !integer(value.reward_amount_minor, 1) ||
        value.reward_item_id != null ||
        value.reward_variant_id != null
      : value.reward_type !== "item" ||
        value.reward_amount_minor !== 0 ||
        !integer(value.reward_item_id, 1) ||
        (value.reward_variant_id != null &&
          !integer(value.reward_variant_id, 1))
  )
    return fail();
  return value as unknown as LoyaltyRules;
}

/** Accept only complete translated snapshots; money and versions never get defaults. */
export function checkedLoyaltyProgram(value: unknown): LoyaltyProgram {
  if (
    !object(value) ||
    typeof value.id !== "string" ||
    !uuid.test(value.id) ||
    typeof value.version_id !== "string" ||
    !uuid.test(value.version_id) ||
    !integer(value.revision, 1) ||
    typeof value.enabled !== "boolean" ||
    !object(value.content) ||
    !date(value.updated_at)
  )
    return fail();
  rules(value.rules);
  for (const lang of ["en", "fr", "he"]) {
    const c = value.content[lang];
    if (!object(c) || !text(c.name, 100) || !text(c.terms, 4000, true))
      return fail();
  }
  return value as unknown as LoyaltyProgram;
}

/** A missing program and membership are a pair; unknown data is never a zero balance. */
export function checkedLoyaltyMembership(
  value: unknown,
): LoyaltyMembershipSnapshot {
  if (!object(value)) return fail();
  if (value.program === null && value.membership === null)
    return { program: null, membership: null };
  const p = checkedLoyaltyProgram(value.program),
    m = value.membership;
  if (
    !object(m) ||
    typeof m.id !== "string" ||
    !uuid.test(m.id) ||
    m.program_id !== p.id ||
    !["active", "closed"].includes(String(m.status)) ||
    !Number.isSafeInteger(m.balance) ||
    !integer(m.revision, 1) ||
    !text(m.accepted_terms_version, 80) ||
    !date(m.accepted_at)
  )
    return fail();
  return {
    program: p,
    membership: m as unknown as NonNullable<
      LoyaltyMembershipSnapshot["membership"]
    >,
  };
}

/** Bound explicit consent only; identity, marketing and financial inputs are rejected. */
export function checkedLoyaltyEnrollment(
  value: unknown,
): LoyaltyEnrollmentInput {
  if (
    !object(value) ||
    Object.keys(value).some(
      (k) =>
        ![
          "program_id",
          "expected_revision",
          "accepted_terms_version",
          "accept_terms",
        ].includes(k),
    ) ||
    typeof value.program_id !== "string" ||
    !uuid.test(value.program_id) ||
    !integer(value.expected_revision, 1) ||
    !text(value.accepted_terms_version, 80) ||
    value.accept_terms !== true
  )
    return fail();
  return value as unknown as LoyaltyEnrollmentInput;
}

/** Recognize only the bounded customer paths, never staff configuration. */
export function isLoyaltyCustomerPath(path: string): boolean {
  return (
    isLoyaltyCheckoutPath(path) || path === "loyalty/program" ||
    path === "me/loyalty-membership" ||
    path === "me/loyalty-rewards"
  );
}

/** The restaurant query is explicit, singular and matches the API's unsigned ID range. */
export function loyaltyRestaurantQuery(query: URLSearchParams): string | null {
  const values = query.getAll("restaurant_id");
  if (
    values.length !== 1 ||
    Array.from(query.keys()).some((k) => k !== "restaurant_id") ||
    !/^\d+$/.test(values[0]) ||
    !integer(Number(values[0]), 1) ||
    Number(values[0]) > 0xffffffff
  )
    return null;
  return String(Number(values[0]));
}

/** A browser-supplied account ID is only a consistency guard; it grants no access. */
export function loyaltyExpectedAccount(value: string | null): number | null {
  return value !== null && /^\d+$/.test(value) && integer(Number(value), 1)
    ? Number(value)
    : null;
}

/** Match the backend-authenticated account before forwarding a private request. */
export function loyaltyOwnerMatches(value: unknown, expected: number): boolean {
  return (
    object(value) && object(value.account) && value.account.id === expected
  );
}

export interface LoyaltyEnrollmentIntent {
  restaurant: number;
  account: number;
  input: LoyaltyEnrollmentInput;
}
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const key = (rid: number, account: number) =>
  `foody.loyalty-enrollment.v1:${rid}:${account}`;
const encodedInput = (i: LoyaltyEnrollmentInput) =>
  JSON.stringify([
    i.program_id,
    i.expected_revision,
    i.accepted_terms_version,
    i.accept_terms,
  ]);

/** A corrupt or foreign original intent blocks replacement instead of guessing consent. */
export function readLoyaltyEnrollment(
  store: Store,
  rid: number,
  account: number,
): LoyaltyEnrollmentIntent | null {
  try {
    if (!integer(rid, 1) || !integer(account, 1)) throw new Error();
    const raw = store.getItem(key(rid, account));
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      !object(parsed) ||
      parsed.restaurant !== rid ||
      parsed.account !== account
    )
      throw new Error();
    return {
      restaurant: rid,
      account,
      input: checkedLoyaltyEnrollment(parsed.input),
    };
  } catch {
    throw new Error("loyalty_storage_unavailable");
  }
}

/** Persist and read back the exact consent before its first transmission. */
export function saveLoyaltyEnrollment(
  store: Store,
  saved: LoyaltyEnrollmentIntent,
): LoyaltyEnrollmentIntent {
  try {
    checkedLoyaltyEnrollment(saved.input);
    const prior = readLoyaltyEnrollment(store, saved.restaurant, saved.account);
    if (prior && encodedInput(prior.input) !== encodedInput(saved.input))
      throw new Error();
    store.setItem(key(saved.restaurant, saved.account), JSON.stringify(saved));
    const read = readLoyaltyEnrollment(store, saved.restaurant, saved.account);
    if (!read || encodedInput(read.input) !== encodedInput(saved.input))
      throw new Error();
    return read;
  } catch {
    throw new Error("loyalty_storage_unavailable");
  }
}

/** Clear only the original known successful or definitively rejected consent intent. */
export function clearLoyaltyEnrollment(
  store: Store,
  saved: LoyaltyEnrollmentIntent,
): void {
  try {
    const prior = readLoyaltyEnrollment(store, saved.restaurant, saved.account);
    if (!prior || encodedInput(prior.input) !== encodedInput(saved.input))
      throw new Error();
    store.removeItem(key(saved.restaurant, saved.account));
    if (readLoyaltyEnrollment(store, saved.restaurant, saved.account) !== null)
      throw new Error();
  } catch {
    throw new Error("loyalty_storage_unavailable");
  }
}

/** Validate a server-issued page without interpreting progress as reward quantity. */
export function checkedLoyaltyRewards(value: unknown): LoyaltyRewardsPage {
  if (
    !object(value) ||
    !Array.isArray(value.rewards) ||
    value.rewards.length > 20 ||
    !date(value.as_of) ||
    !(
      value.next_cursor === null ||
      (typeof value.next_cursor === "string" &&
        /^[A-Za-z0-9_-]{1,160}$/.test(value.next_cursor))
    )
  )
    return fail();
  if (value.membership_id === null) {
    if (
      value.program_id !== null ||
      value.membership_revision !== 0 ||
      value.rewards.length ||
      value.next_cursor !== null
    )
      return fail();
  } else if (
    typeof value.membership_id !== "string" ||
    !uuid.test(value.membership_id) ||
    typeof value.program_id !== "string" ||
    !uuid.test(value.program_id) ||
    !integer(value.membership_revision, 1)
  )
    return fail();
  const seen = new Set<string>();
  for (const r of value.rewards) {
    if (
      !object(r) ||
      typeof r.id !== "string" ||
      !uuid.test(r.id) ||
      seen.has(r.id) ||
      !integer(r.revision, 1) ||
      !["available", "reserved", "redeemed", "revoked", "expired"].includes(
        String(r.status),
      ) ||
      !date(r.created_at) ||
      (r.expires_at !== null && !date(r.expires_at)) ||
      (r.redeemed_at !== null && !date(r.redeemed_at)) ||
      ![
        "",
        "reserved",
        "redeemed",
        "revoked",
        "expired",
        "membership_closed",
        "negative_balance",
        "currency_changed",
        "terms_changed",
        "program_paused",
        "product_unavailable",
      ].includes(String(r.blocked_reason))
    )
      return fail();
    seen.add(r.id);
    const frozen = rules(r.rules);
    if (
      (r.status !== "available" && r.blocked_reason !== r.status) ||
      (r.status === "available" &&
        ["reserved", "redeemed", "revoked", "expired"].includes(
          String(r.blocked_reason),
        ))
    )
      return fail();
    if (r.product !== null) {
      if (
        frozen.reward_type !== "item" ||
        !object(r.product) ||
        typeof r.product.available !== "boolean" ||
        !object(r.product.names)
      )
        return fail();
      for (const lang of ["en", "fr", "he"])
        if (!text(r.product.names[lang], 4000)) return fail();
      if (r.product.variant_names !== undefined) {
        if (!object(r.product.variant_names) || !frozen.reward_variant_id)
          return fail();
        for (const lang of ["en", "fr", "he"])
          if (!text(r.product.variant_names[lang], 4000)) return fail();
      }
    }
    if (
      frozen.reward_type === "item" &&
      (!r.product || !r.product.available) &&
      r.blocked_reason === ""
    )
      return fail();
    if (
      r.status === "available" &&
      r.expires_at !== null &&
      Date.parse(r.expires_at as string) <= Date.parse(value.as_of as string)
    )
      return fail();
  }
  return value as unknown as LoyaltyRewardsPage;
}

/** Only the reward read accepts a singular bounded opaque pagination cursor. */
export function loyaltyCustomerQuery(
  path: string,
  query: URLSearchParams,
): URLSearchParams | null {
  const scoped = new URLSearchParams(query);
  const cursor = scoped.getAll("cursor");
  if (path === "me/loyalty-rewards") {
    if (
      cursor.length > 1 ||
      (cursor.length === 1 && !/^[A-Za-z0-9_-]{1,160}$/.test(cursor[0]))
    )
      return null;
    scoped.delete("cursor");
  }
  const rid = loyaltyRestaurantQuery(scoped);
  if (!rid) return null;
  const result = new URLSearchParams({ restaurant_id: rid });
  if (cursor.length) result.set("cursor", cursor[0]);
  return result;
}
