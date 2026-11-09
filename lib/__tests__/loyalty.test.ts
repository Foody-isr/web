import test from "node:test";
import assert from "node:assert/strict";
import {
  checkedLoyaltyEnrollment,
  checkedLoyaltyMembership,
  checkedLoyaltyProgram,
  clearLoyaltyEnrollment,
  loyaltyExpectedAccount,
  loyaltyOwnerMatches,
  loyaltyRestaurantQuery,
  readLoyaltyEnrollment,
  saveLoyaltyEnrollment,
} from "../loyalty";
import { isOrderRoute } from "../themes/useResolvedTheme";
import { resolveCustomerAPIPath } from "../customer-api-proxy";

const id = "11111111-1111-4111-8111-111111111111";
const program = {
  id,
  version_id: id,
  revision: 1,
  enabled: true,
  updated_at: "2026-11-01T08:00:00Z",
  rules: {
    mode: "visits",
    currency: "ILS",
    spend_step_minor: 0,
    units_per_step: 1,
    minimum_purchase_minor: 0,
    reward_threshold: 5,
    reward_type: "fixed",
    reward_amount_minor: 1200,
    reward_validity_days: 0,
    terms_version: "v1",
  },
  content: {
    en: { name: "Synthetic", terms: "Synthetic terms." },
    fr: { name: "Synthétique", terms: "Conditions synthétiques." },
    he: { name: "דוגמה", terms: "תנאים לדוגמה." },
  },
};
const input = {
  program_id: id,
  expected_revision: 1,
  accepted_terms_version: "v1",
  accept_terms: true as const,
};
const saved = { restaurant: 9001, account: 7, input };
function memory() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
}

test("loyalty gateway permits only the restaurant program and customer membership methods", () => {
  assert.equal(
    resolveCustomerAPIPath("GET", ["loyalty", "program"]),
    "loyalty/program",
  );
  for (const method of ["GET", "POST"])
    assert.equal(
      resolveCustomerAPIPath(method, ["me", "loyalty-membership"]),
      "me/loyalty-membership",
    );
  for (const method of ["PUT", "DELETE", "PATCH"])
    assert.equal(
      resolveCustomerAPIPath(method, ["me", "loyalty-membership"]),
      null,
    );
  assert.equal(
    resolveCustomerAPIPath("PUT", ["loyalty", "program"]),
    null,
  );
  assert.equal(
    resolveCustomerAPIPath("GET", ["loyalty", "checkout-resolutions"]),
    null,
  );
});
test("restaurant scope and expected account reject aliases that change identity", () => {
  assert.equal(
    loyaltyRestaurantQuery(new URLSearchParams("restaurant_id=9001")),
    "9001",
  );
  for (const q of [
    "",
    "restaurant_id=0",
    "restaurant_id=1&restaurant_id=2",
    "restaurant_id=1&account_id=7",
    "restaurant_id=4294967296",
  ])
    assert.equal(loyaltyRestaurantQuery(new URLSearchParams(q)), null);
  assert.equal(loyaltyExpectedAccount("7"), 7);
  for (const id of [null, "0", "7,8", "-1", "9007199254740992"])
    assert.equal(loyaltyExpectedAccount(id), null);
  assert.equal(loyaltyOwnerMatches({ account: { id: 7 } }, 7), true);
  assert.equal(loyaltyOwnerMatches({ account: { id: 8 } }, 7), false);
});
test("program snapshots need all languages and exact supported monetary rules", () => {
  assert.equal(checkedLoyaltyProgram(program).rules.reward_amount_minor, 1200);
  assert.throws(() =>
    checkedLoyaltyProgram({ ...program, content: { en: program.content.en } }),
  );
  assert.throws(() =>
    checkedLoyaltyProgram({
      ...program,
      rules: { ...program.rules, reward_amount_minor: -1 },
    }),
  );
  assert.throws(() =>
    checkedLoyaltyProgram({
      ...program,
      rules: { ...program.rules, currency: "XXX" },
    }),
  );
});
test("a negative progression is preserved and never represented as a reward count", () => {
  const membership = {
    id,
    program_id: id,
    status: "active",
    balance: -3,
    revision: 2,
    accepted_terms_version: "v1",
    accepted_at: "2026-11-01T08:00:00Z",
  };
  assert.equal(
    checkedLoyaltyMembership({ program, membership }).membership?.balance,
    -3,
  );
  assert.deepEqual(
    checkedLoyaltyMembership({ program: null, membership: null }),
    { program: null, membership: null },
  );
  assert.throws(() => checkedLoyaltyMembership({ program, membership: null }));
  assert.throws(() =>
    checkedLoyaltyMembership({
      program,
      membership: { ...membership, program_id: "other" },
    }),
  );
  assert.throws(() =>
    checkedLoyaltyMembership({
      program,
      membership: { ...membership, balance: undefined },
    }),
  );
});
test("enrollment requires exact explicit consent without account or marketing payload", () => {
  assert.deepEqual(checkedLoyaltyEnrollment(input), input);
  for (const extra of [
    { customer_account_id: 8 },
    { marketing_consent: true },
    { balance: 100 },
  ])
    assert.throws(() => checkedLoyaltyEnrollment({ ...input, ...extra }));
  assert.throws(() =>
    checkedLoyaltyEnrollment({ ...input, accept_terms: false }),
  );
  assert.throws(() =>
    checkedLoyaltyEnrollment({ ...input, expected_revision: 0 }),
  );
});
test("original consent survives reload and cannot be adopted by another account or restaurant", () => {
  const store = memory();
  saveLoyaltyEnrollment(store, saved);
  assert.deepEqual(readLoyaltyEnrollment(store, 9001, 7), saved);
  assert.equal(readLoyaltyEnrollment(store, 9002, 7), null);
  assert.equal(readLoyaltyEnrollment(store, 9001, 8), null);
  assert.throws(() =>
    saveLoyaltyEnrollment(store, {
      ...saved,
      input: { ...input, expected_revision: 2 },
    }),
  );
  clearLoyaltyEnrollment(store, saved);
  assert.equal(readLoyaltyEnrollment(store, 9001, 7), null);
});
test("broken storage prevents replacement and acknowledgement clearing remains scoped", () => {
  const store = memory();
  saveLoyaltyEnrollment(store, saved);
  assert.throws(() =>
    clearLoyaltyEnrollment(
      {
        ...store,
        removeItem: () => {
          throw new Error("quota");
        },
      },
      saved,
    ),
  );
  assert.deepEqual(readLoyaltyEnrollment(store, 9001, 7), saved);
  store.setItem(Array.from(store.data.keys())[0], "{");
  assert.throws(() => readLoyaltyEnrollment(store, 9001, 7));
  assert.throws(() =>
    saveLoyaltyEnrollment(
      {
        getItem: () => null,
        setItem: () => {
          throw new Error("quota");
        },
        removeItem: () => {},
      },
      saved,
    ),
  );
});

test("the loyalty account namespace inherits commerce themes without masking merchant pages", () => {
  for (const path of ["/r/demo/account/loyalty", "/account/loyalty"])
    assert.equal(isOrderRoute(path), true);
  for (const path of [
    "/r/demo/loyalty",
    "/loyalty",
    "/account/loyalty-settings",
  ])
    assert.equal(isOrderRoute(path), false);
});
