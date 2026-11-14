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

test("card capture uses the Verifone SDK format and encrypts the ABS identity separately", async () => {
  const { privateKey, publicKey } = await pgp.generateKey({
    type: "rsa",
    rsaBits: 2048,
    userIDs: [{ name: "Synthetic capture test" }],
    format: "armored",
  });
  const key = await pgp.readPrivateKey({ armoredKey: privateKey });
  const sdkCiphertext = btoa("-----BEGIN PGP MESSAGE-----\nsynthetic SDK result\n-----END PGP MESSAGE-----");
  const encodedPublicKey = btoa(publicKey);
  let sdkCalls = 0;
  const encrypted = await encryptVerifoneCard(card, {
    public_key: encodedPublicKey,
    public_key_alias: "synthetic-key",
    environment: "sandbox",
  }, async () => ({
    encryptCard: async (input, publicKeyArgument) => {
      sdkCalls++;
      assert.deepEqual(input, {
        cardNumber: card.cardNumber.replaceAll(" ", ""),
        expiryMonth: card.expiryMonth,
        expiryYear: card.expiryYear.slice(-2),
        cvv: card.cvv,
      });
      assert.equal(publicKeyArgument, encodedPublicKey);
      return sdkCiphertext;
    },
  }));
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
  assert.equal(sdkCalls, 1);
  assert.equal(encrypted.encrypted_card, sdkCiphertext);
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
