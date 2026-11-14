import { createApplePayMerchantSession, type VerifoneWalletCapabilities } from "@/services/api";
import type { Locale } from "@/lib/i18n";

type GoogleConfig = NonNullable<VerifoneWalletCapabilities["google_pay"]>;
type GoogleMethod = {
  type: "CARD";
  parameters: { allowedAuthMethods: string[]; allowedCardNetworks: string[] };
  tokenizationSpecification?: {
    type: "PAYMENT_GATEWAY";
    parameters: { gateway: "verifone"; gatewayMerchantId: string };
  };
};
type GoogleRequest = {
  apiVersion: number;
  apiVersionMinor: number;
  allowedPaymentMethods: GoogleMethod[];
};
type GooglePayment = {
  paymentMethodData?: { tokenizationData?: { type?: string; token?: string } };
};
export type GoogleWalletClient = {
  isReadyToPay(request: GoogleRequest): Promise<{ result: boolean }>;
  createButton(options: {
    onClick(): void;
    buttonType: "pay";
    buttonColor: "black" | "white";
    buttonLocale: Locale;
    buttonSizeMode: "fill";
    allowedPaymentMethods: GoogleMethod[];
  }): HTMLElement;
  loadPaymentData(request: GoogleRequest & {
    merchantInfo: { merchantName: string; merchantId?: string };
    transactionInfo: { countryCode: "IL"; currencyCode: "ILS"; totalPriceStatus: "FINAL"; totalPrice: string };
  }): Promise<GooglePayment>;
};
type GoogleConstructor = new (options: { environment: "TEST" | "PRODUCTION" }) => GoogleWalletClient;

type AppleSession = {
  onvalidatemerchant: (() => void) | null;
  onpaymentauthorized: ((event: { payment: { token: { paymentData: object } } }) => void) | null;
  oncancel: (() => void) | null;
  begin(): void;
  abort(): void;
  completeMerchantValidation(session: object): void;
  completePayment(result: { status: number }): void;
};
type AppleRequest = {
  countryCode: "IL";
  currencyCode: "ILS";
  merchantCapabilities: ["supports3DS"];
  supportedNetworks: string[];
  total: { label: string; type: "final"; amount: string };
};
type AppleConstructor = {
  new (version: number, request: AppleRequest): AppleSession;
  supportsVersion(version: number): boolean;
  canMakePayments(): boolean;
  STATUS_SUCCESS: number;
  STATUS_FAILURE: number;
};

function applePayAPI() {
  return (window as Window & { ApplePaySession?: AppleConstructor }).ApplePaySession;
}

/** Apple Pay is only offered when the browser can start a payment session. */
export function canUseApplePay(): boolean {
  try {
    const api = applePayAPI();
    return window.isSecureContext && api?.supportsVersion(3) === true && api.canMakePayments();
  } catch {
    return false;
  }
}

function googleAPI(): GoogleConstructor | undefined {
  return (window as Window & { google?: { payments?: { api?: { PaymentsClient?: GoogleConstructor } } } })
    .google?.payments?.api?.PaymentsClient;
}

let googleScript: Promise<GoogleConstructor> | undefined;

function loadGooglePay() {
  const existing = googleAPI();
  if (existing) return Promise.resolve(existing);
  if (googleScript) return googleScript;
  googleScript = new Promise<GoogleConstructor>((resolve, reject) => {
    const script = document.createElement("script");
    const fail = () => {
      window.clearTimeout(timeout);
      script.remove();
      reject(new Error("Google Pay is unavailable"));
    };
    const timeout = window.setTimeout(fail, 10_000);
    script.src = "https://pay.google.com/gp/p/js/pay.js";
    script.referrerPolicy = "no-referrer";
    script.async = true;
    script.onload = () => {
      const client = googleAPI();
      if (!client) return fail();
      window.clearTimeout(timeout);
      resolve(client);
    };
    script.onerror = fail;
    document.head.append(script);
  }).catch(() => {
    googleScript = undefined;
    throw new Error("Google Pay is unavailable");
  });
  return googleScript;
}

export const googleWalletMethod: GoogleMethod = {
  type: "CARD",
  parameters: {
    allowedAuthMethods: ["CRYPTOGRAM_3DS"],
    allowedCardNetworks: ["VISA", "MASTERCARD", "AMEX"],
  },
};

const googleRequest: GoogleRequest = { apiVersion: 2, apiVersionMinor: 0, allowedPaymentMethods: [googleWalletMethod] };

/** Loads Google's SDK and checks readiness before showing its official button. */
export async function readyGooglePay(environment: GoogleConfig["environment"]): Promise<GoogleWalletClient | null> {
  if (!window.isSecureContext) return null;
  const PaymentsClient = await loadGooglePay();
  const client = new PaymentsClient({ environment: environment === "production" ? "PRODUCTION" : "TEST" });
  return (await client.isReadyToPay(googleRequest)).result ? client : null;
}

/** Opens Google Pay from the click and extracts only the encrypted gateway token. */
export async function requestGoogleWallet(client: GoogleWalletClient, config: GoogleConfig, amountMinor: number): Promise<object | null> {
  try {
    const result = await client.loadPaymentData({
      ...googleRequest,
      allowedPaymentMethods: [{
        ...googleWalletMethod,
        tokenizationSpecification: {
          type: "PAYMENT_GATEWAY",
          parameters: { gateway: "verifone", gatewayMerchantId: config.gateway_merchant_id },
        },
      }],
      merchantInfo: { merchantName: config.merchant_name, ...(config.merchant_id ? { merchantId: config.merchant_id } : {}) },
      transactionInfo: { countryCode: "IL", currencyCode: "ILS", totalPriceStatus: "FINAL", totalPrice: (amountMinor / 100).toFixed(2) },
    });
    const tokenization = result.paymentMethodData?.tokenizationData;
    if (tokenization?.type !== "PAYMENT_GATEWAY") throw new Error();
    const token: unknown = JSON.parse(tokenization.token || "null");
    if (!token || typeof token !== "object" || Array.isArray(token)) throw new Error();
    return token;
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error && error.statusCode === "CANCELED") return null;
    throw new Error("Google Pay could not authorize the payment");
  }
}

/** Opens Apple Pay from the click and reports the Foody settlement result to Apple. */
export function requestAppleWallet(
  restaurantId: string,
  merchantName: string,
  amountMinor: number,
  charge: (token: object) => Promise<boolean>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const ApplePaySession = applePayAPI();
    if (!ApplePaySession || !canUseApplePay()) {
      reject(new Error("Apple Pay is unavailable"));
      return;
    }
    const session = new ApplePaySession(3, {
      countryCode: "IL",
      currencyCode: "ILS",
      merchantCapabilities: ["supports3DS"],
      supportedNetworks: ["visa", "masterCard", "amex"],
      total: { label: merchantName, type: "final", amount: (amountMinor / 100).toFixed(2) },
    });
    let authorized = false;
    let canceled = false;
    session.oncancel = () => {
      canceled = true;
      if (!authorized) resolve();
    };
    session.onvalidatemerchant = () => {
      void createApplePayMerchantSession(restaurantId)
        .then((merchantSession) => { if (!canceled) session.completeMerchantValidation(merchantSession); })
        .catch(() => {
          if (canceled) return;
          reject(new Error("Apple Pay merchant validation failed"));
          try { session.abort(); } catch { /* The sheet is already closed. */ }
        });
    };
    session.onpaymentauthorized = ({ payment }) => {
      if (authorized || canceled) return;
      authorized = true;
      void charge(payment.token.paymentData).then(
        (completed) => { if (!canceled) session.completePayment({ status: completed ? ApplePaySession.STATUS_SUCCESS : ApplePaySession.STATUS_FAILURE }); },
        () => { if (!canceled) session.completePayment({ status: ApplePaySession.STATUS_FAILURE }); },
      ).then(resolve, reject);
    };
    session.begin();
  });
}
