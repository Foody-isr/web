import type { CardCaptureKey, EncryptedCardPayment } from "@/services/api";

export type CardCaptureInput = {
  cardNumber: string;
  cardholderName: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  identity: string;
};

/** Validates without echoing cardholder data in exceptions or diagnostics. */
export function validCardCapture(
  input: CardCaptureInput,
  now = new Date(),
): boolean {
  const pan = input.cardNumber.replace(/[ -]/g, "");
  if (
    !/^\d{12,19}$/.test(pan) ||
    !/^\d{3,4}$/.test(input.cvv) ||
    !/^\d{9}$/.test(input.identity) ||
    !input.cardholderName.trim() ||
    input.cardholderName.length > 100 ||
    !/^\d{1,2}$/.test(input.expiryMonth) ||
    !/^\d{4}$/.test(input.expiryYear)
  )
    return false;
  const month = Number(input.expiryMonth),
    year = Number(input.expiryYear);
  if (
    month < 1 ||
    month > 12 ||
    year < now.getUTCFullYear() ||
    year > now.getUTCFullYear() + 25 ||
    (year === now.getUTCFullYear() && month < now.getUTCMonth() + 1)
  )
    return false;
  let sum = 0,
    double = false;
  for (let i = pan.length - 1; i >= 0; i--) {
    let value = Number(pan[i]);
    if (double) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Encrypts in memory in the browser; returns no PAN/CVV/identity plaintext.
 * Never store this input/output in React Query, Zustand, analytics or storage.
 * Direct capture remains a sandbox pilot, not a PCI certification. */
export async function encryptVerifoneCard(
  input: CardCaptureInput,
  captureKey: CardCaptureKey,
): Promise<EncryptedCardPayment> {
  try {
    if (
      captureKey.environment !== "sandbox" ||
      !validCardCapture(input) ||
      captureKey.public_key.length > 65536
    )
      throw new Error();
    const pgp = await import("openpgp");
    const key = await pgp.readKey({ armoredKey: atob(captureKey.public_key) });
    if (key.isPrivate()) throw new Error();
    const subkeys = key.getSubkeys();
    const primary = key.getAlgorithmInfo();
    // Operation-local compatibility for the exact existing CST K1571 key.
    // All signature, binding, expiry, revocation and hash checks remain enabled.
    // Never change global OpenPGP policy or allow arbitrary legacy curves.
    const pinnedCST =
      captureKey.public_key_alias === "K1571" &&
      key.getFingerprint() === "b5e314ad12b3464edd7ce8feb62458b6430796c5" &&
      primary.algorithm === "ecdsa" &&
      primary.curve === "secp256k1" &&
      subkeys.length === 1 &&
      subkeys[0].getFingerprint() ===
        "ee6f902aaa900c61af96de653e361202e314c886" &&
      subkeys[0].getAlgorithmInfo().algorithm === "ecdh" &&
      subkeys[0].getAlgorithmInfo().curve === "secp256k1";
    const rejectCurves = new Set(pgp.config.rejectCurves);
    if (pinnedCST) rejectCurves.delete(pgp.enums.curve.secp256k1);
    const config = { ...pgp.config, rejectCurves, aeadProtect: false };
    await key.getEncryptionKey(undefined, new Date(), undefined, config);
    const encrypt = async (text: string) =>
      btoa(
        await pgp.encrypt({
          message: await pgp.createMessage({ text }),
          encryptionKeys: key,
          format: "armored",
          config,
        }),
      );
    const card = JSON.stringify({
      cardNumber: input.cardNumber.replace(/[ -]/g, ""),
      cardholderName: input.cardholderName.trim(),
      expiryMonth: input.expiryMonth.padStart(2, "0"),
      expiryYear: input.expiryYear,
      cvv: input.cvv,
      captureTime: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    });
    return {
      encrypted_card: await encrypt(card),
      public_key_alias: captureKey.public_key_alias,
      encrypted_identity_card_number: await encrypt(input.identity),
    };
  } catch {
    // Library errors can contain user input. Only a constant safe error escapes.
    throw new Error("Card encryption failed. No payment was attempted.");
  }
}
