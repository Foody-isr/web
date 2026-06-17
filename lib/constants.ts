// VAT rate for Israel (18%)
export const VAT_RATE = 0.18;
export const VAT_MULTIPLIER = 1 + VAT_RATE; // 1.18

// Calculate subtotal and VAT from total (inclusive)
export function calculateVAT(total: number) {
  const subtotal = total / VAT_MULTIPLIER;
  const vat = total - subtotal;
  return { subtotal, vat };
}

// Currency
export const CURRENCY_CODE = "ILS";
export const CURRENCY_SYMBOL = "₪";

/** Public Google OAuth client id for guest "Sign in with Google" (not secret). */
export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  "701419085438-vrqnmjoo3msu5rulg8vh8fttoqg0bitv.apps.googleusercontent.com";

const CURRENCY_SYMBOLS: Record<string, string> = {
  ILS: "₪",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

/** Map an ISO currency code (e.g. "ILS") to its symbol (e.g. "₪"). */
export function currencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code] || code;
}
