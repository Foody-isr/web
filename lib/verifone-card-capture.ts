import type { CardCaptureKey, EncryptedCardPayment } from "@/services/api";

export type CardCaptureInput = {
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  identity: string;
};

/** Formats card digits for the checkout field while keeping the full supported number length. */
export function formatVerifoneCardNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 19);
  if (/^3[47]/.test(digits)) return [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10)].filter(Boolean).join(" ");
  return digits.match(/.{1,4}/g)?.join(" ") ?? "";
}

/** Formats the compact MM/YY field without storing its value. */
export function formatVerifoneCardExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

/** Validates individual card inputs so the checkout can focus the field to correct. */
export function invalidCardCaptureField(input: CardCaptureInput, now = new Date()): "cardNumber" | "expiry" | "cvv" | "identity" | null {
  const pan = input.cardNumber.replace(/[ -]/g, "");
  let sum = 0;
  let double = false;
  for (let i = pan.length - 1; i >= 0; i--) {
    let value = Number(pan[i]);
    if (double) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    double = !double;
  }
  if (!/^\d{12,19}$/.test(pan) || sum % 10 !== 0) return "cardNumber";

  const month = Number(input.expiryMonth);
  const year = Number(input.expiryYear);
  if (!/^\d{1,2}$/.test(input.expiryMonth) || !/^\d{4}$/.test(input.expiryYear) || month < 1 || month > 12 ||
    year < now.getUTCFullYear() || year > Math.min(now.getUTCFullYear() + 25, 2099) ||
    (year === now.getUTCFullYear() && month < now.getUTCMonth() + 1)) return "expiry";
  if (!/^\d{3,4}$/.test(input.cvv)) return "cvv";
  if (!/^\d{9}$/.test(input.identity)) return "identity";
  return null;
}

type VerifoneSDK = {
  encryptCard: (
    card: Pick<CardCaptureInput, "cardNumber" | "expiryMonth" | "expiryYear" | "cvv">,
    publicKey: string,
  ) => Promise<string>;
};

declare global {
  interface Window {
    verifone?: VerifoneSDK;
  }
}

let sdkLoad: Promise<VerifoneSDK> | undefined;

function loadVerifoneSDK(): Promise<VerifoneSDK> {
  if (window.verifone?.encryptCard) return Promise.resolve(window.verifone);
  if (sdkLoad) return sdkLoad;
  sdkLoad = new Promise<VerifoneSDK>((resolve, reject) => {
    const script = document.createElement("script");
    const fail = () => {
      script.remove();
      reject(new Error("Verifone SDK unavailable"));
    };
    const timeout = window.setTimeout(fail, 15_000);
    script.src = "https://cst.jsclient.vficloud.net/verifone.js";
    script.referrerPolicy = "no-referrer";
    script.onload = () => {
      window.clearTimeout(timeout);
      if (window.verifone?.encryptCard) resolve(window.verifone);
      else fail();
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      fail();
    };
    document.head.append(script);
  }).catch((error: unknown) => {
    sdkLoad = undefined;
    throw error;
  });
  return sdkLoad;
}

/** Validates without echoing cardholder data in exceptions or diagnostics. */
export function validCardCapture(
  input: CardCaptureInput,
  now = new Date(),
): boolean {
  return invalidCardCaptureField(input, now) === null;
}

/** Encrypts the card with the official SDK and encrypts the ABS identity separately. */
export async function encryptVerifoneCard(
  input: CardCaptureInput,
  captureKey: CardCaptureKey,
  loadSDK: () => Promise<VerifoneSDK> = loadVerifoneSDK,
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
    const identity = await pgp.encrypt({
      message: await pgp.createMessage({ text: input.identity }),
      encryptionKeys: key,
      format: "armored",
      config,
    });
    const sdk = await loadSDK();
    const card = await sdk.encryptCard({
      cardNumber: input.cardNumber.replace(/[ -]/g, ""),
      expiryMonth: input.expiryMonth.padStart(2, "0"),
      expiryYear: input.expiryYear.slice(-2),
      cvv: input.cvv,
    }, captureKey.public_key);
    if (!atob(card).startsWith("-----BEGIN PGP MESSAGE-----")) throw new Error();
    return {
      encrypted_card: card,
      public_key_alias: captureKey.public_key_alias,
      encrypted_identity_card_number: btoa(identity),
    };
  } catch {
    // Library errors can contain user input. Only a constant safe error escapes.
    throw new Error("Card encryption failed. No payment was attempted.");
  }
}
