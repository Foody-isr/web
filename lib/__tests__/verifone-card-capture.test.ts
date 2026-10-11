import assert from "node:assert/strict";
import test from "node:test";
import * as pgp from "openpgp";
import {
  encryptVerifoneCard,
  validCardCapture,
  type CardCaptureInput,
} from "../verifone-card-capture";
import { cstPublicKey } from "./fixtures/verifone-cst-key";

// Synthetic test data only; never use a customer's card in unit tests.
const card: CardCaptureInput = {
  cardNumber: "4111 1111 1111 1111",
  cardholderName: "Test Customer",
  expiryMonth: "12",
  expiryYear: String(new Date().getUTCFullYear() + 1),
  cvv: "123",
  identity: "000000000",
};

test("card capture rejects invalid/expired details without echoing input", async () => {
  assert.equal(validCardCapture(card), true);
  for (const changes of [
    { cardNumber: "4111111111111112" },
    { expiryMonth: "13" },
    { expiryYear: "2000" },
    { cvv: "12" },
    { identity: "bad" },
    { cardholderName: "" },
  ]) {
    assert.equal(validCardCapture({ ...card, ...changes }), false);
  }
  await assert.rejects(
    encryptVerifoneCard(card, {
      public_key: "broken",
      public_key_alias: "test",
      environment: "sandbox",
    }),
    (error: Error) => {
      assert.equal(
        error.message,
        "Card encryption failed. No payment was attempted.",
      );
      assert.ok(!error.message.includes(card.cardNumber));
      return true;
    },
  );
});

test("capture encrypts compact timestamped card JSON and identity separately", async () => {
  const { privateKey, publicKey } = await pgp.generateKey({
    type: "rsa",
    rsaBits: 2048,
    userIDs: [{ name: "Synthetic capture test" }],
    format: "armored",
  });
  const key = await pgp.readPrivateKey({ armoredKey: privateKey });
  const encrypted = await encryptVerifoneCard(card, {
    public_key: btoa(publicKey),
    public_key_alias: "synthetic-key",
    environment: "sandbox",
  });
  assert.deepEqual(Object.keys(encrypted).sort(), [
    "encrypted_card",
    "encrypted_identity_card_number",
    "public_key_alias",
  ]);
  assert.equal(encrypted.public_key_alias, "synthetic-key");
  const decrypt = async (value: string) =>
    (
      await pgp.decrypt({
        message: await pgp.readMessage({ armoredMessage: atob(value) }),
        decryptionKeys: key,
        format: "utf8",
      })
    ).data;
  const text = await decrypt(encrypted.encrypted_card);
  const plaintext = JSON.parse(text);
  assert.equal(text, JSON.stringify(plaintext));
  assert.deepEqual(Object.keys(plaintext), [
    "cardNumber",
    "cardholderName",
    "expiryMonth",
    "expiryYear",
    "cvv",
    "captureTime",
  ]);
  assert.equal(plaintext.cardNumber, card.cardNumber.replaceAll(" ", ""));
  assert.equal(plaintext.cvv, card.cvv);
  assert.match(plaintext.captureTime, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  assert.ok(Math.abs(Date.now() - Date.parse(plaintext.captureTime)) < 5000);
  assert.equal(
    await decrypt(encrypted.encrypted_identity_card_number),
    card.identity,
  );
  assert.equal(
    pgp.config.rejectCurves.has(pgp.enums.curve.secp256k1),
    true,
    "global curve policy stays intact",
  );
});

test("CST fixture is pinned and an unrelated alias never gets legacy-curve compatibility", async () => {
  const key = {
    public_key: cstPublicKey,
    public_key_alias: "K1571",
    environment: "sandbox" as const,
  };
  const parsed = await pgp.readKey({ armoredKey: atob(key.public_key) });
  assert.equal(
    parsed.getFingerprint(),
    "b5e314ad12b3464edd7ce8feb62458b6430796c5",
  );
  assert.equal(
    parsed.getSubkeys()[0].getFingerprint(),
    "ee6f902aaa900c61af96de653e361202e314c886",
  );
  // Positive K1571 encryption is exercised in Playwright using the actual
  // browser crypto build, not OpenPGP's Node-only optional ECC utilities.
  await assert.rejects(
    encryptVerifoneCard(card, { ...key, public_key_alias: "OTHER" }),
  );
  assert.equal(pgp.config.rejectCurves.has(pgp.enums.curve.secp256k1), true);
});
