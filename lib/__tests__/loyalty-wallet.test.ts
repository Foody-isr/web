import test from "node:test";
import assert from "node:assert/strict";
import {
  checkedGoogleWalletURL,
  checkedWalletAssertion,
  checkedWalletCapabilities,
  walletCustomerAction,
  walletRestaurant,
  walletReturnPath,
} from "../loyalty-wallet";
import { resolveCustomerAPIPath } from "../customer-api-proxy";

const id = "11111111-1111-4111-8111-111111111111";
const card = {
  id,
  platform: "apple",
  status: "active",
  updated_at: "2026-11-01T08:00:00Z",
  pending: false,
};
const caps = {
  membership_id: id,
  program_id: id,
  apple: true,
  google: false,
  cards: [card],
};

test("Wallet metadata never carries installation claims, credentials or duplicate active cards", () => {
  assert.deepEqual(checkedWalletCapabilities(caps), caps);
  for (const invalid of [
    { ...caps, authentication_token: "private" },
    { ...caps, installed: true },
    {
      ...caps,
      cards: [card, { ...card, id: "22222222-2222-4222-8222-222222222222" }],
    },
    { ...caps, cards: [card, { ...card, platform: "google" }] },
    { ...caps, cards: [{ ...card, qr: "private" }] },
    { ...caps, cards: [{ ...card, status: "installed" }] },
    { ...caps, cards: [{ ...card, updated_at: "not-a-date" }] },
    { ...caps, membership_id: null },
  ])
    assert.throws(() => checkedWalletCapabilities(invalid));
  assert.equal(
    checkedWalletCapabilities({
      ...caps,
      apple: false,
      cards: [{ ...card, pending: true }],
    }).cards.length,
    1,
  );
});
test("Only a bounded Google reference link reaches the explicit navigation", () => {
  const url = "https://pay.google.com/gp/v/save/a.b.c";
  assert.equal(checkedGoogleWalletURL({ save_url: url }), url);
  for (const save_url of [
    "http://pay.google.com/gp/v/save/a.b.c",
    "https://pay.google.com.attacker.invalid/gp/v/save/a.b.c",
    "https://user:password@pay.google.com/gp/v/save/a.b.c",
    `${url}?session=private`,
    `${url}#private`,
    "https://pay.google.com/gp/v/save/a.b",
    "https://pay.google.com:444/gp/v/save/a.b.c",
    `https://pay.google.com/gp/v/save/${"a".repeat(1800)}.b.c`,
    "javascript:alert(1)",
  ])
    assert.throws(() => checkedGoogleWalletURL({ save_url }));
  assert.throws(() =>
    checkedGoogleWalletURL({ save_url: url, token: "private" }),
  );
});
test("Owned assertions reject identity, balance and foreign return-path inputs", () => {
  assert.deepEqual(
    checkedWalletAssertion({ membership_id: id, program_id: id }),
    { membership_id: id, program_id: id },
  );
  for (const change of [
    { account_id: 7 },
    { balance: 100 },
    { authentication_token: "private" },
    { membership_id: "00000000-0000-0000-0000-000000000000" },
  ])
    assert.throws(() =>
      checkedWalletAssertion({ membership_id: id, program_id: id, ...change }),
    );
  for (const value of [
    "0",
    "01",
    "-1",
    "4294967296",
    "19&account_id=7",
    "1.0",
    19,
    null,
  ])
    assert.equal(walletRestaurant(value), null);
  assert.equal(walletRestaurant("4294967295"), 4294967295);
  assert.equal(
    walletReturnPath(19, "/r/19/account/loyalty"),
    "/r/19/account/loyalty",
  );
  assert.equal(walletReturnPath(19, "/account/loyalty"), "/account/loyalty");
  for (const value of [
    "//attacker.invalid",
    "/r/20/account/loyalty",
    "/account/loyalty?redirect=https://attacker.invalid",
    "/account/loyalty/../orders",
  ])
    assert.equal(walletReturnPath(19, value), null);
});
test("The independent Wallet gateway never exposes native Apple protocol or financial writes", () => {
  for (const [method, path] of [
    ["GET", "loyalty/wallet"],
    ["POST", "loyalty/wallet/cards/google"],
    ["POST", `loyalty/wallet/cards/apple/${id}/revoke`],
    ["POST", `loyalty/wallet/cards/google/${id}/revoke`],
  ]) {
    assert.ok(walletCustomerAction(method, path));
    assert.equal(
      resolveCustomerAPIPath(method, path.split("/"), true, false, true),
      path,
    );
    assert.equal(
      resolveCustomerAPIPath(method, path.split("/"), true, true, false),
      null,
    );
    assert.equal(
      resolveCustomerAPIPath(method, path.split("/"), false, true, true),
      null,
    );
  }
  for (const path of [
    "loyalty/wallet/cards/apple",
    `loyalty/wallet/cards/google/${id}/delete`,
    "loyalty/wallet/apple/v1/devices/private/registrations",
    `loyalty/wallet/cards/apple/invalid/revoke`,
  ])
    assert.equal(
      resolveCustomerAPIPath("POST", path.split("/"), true, true, true),
      null,
    );
  assert.equal(
    walletCustomerAction("DELETE", `loyalty/wallet/cards/apple/${id}/revoke`),
    null,
  );
  assert.equal(
    resolveCustomerAPIPath("POST", ["loyalty", "checkouts"], true, false, true),
    null,
  );
});
