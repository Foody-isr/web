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
//
// A restaurant carries its own ISO 4217 code (Restaurant.currency, and the
// `currency` field on menu and order responses). These are only the fallback
// used before that value has loaded, and for restaurants created before Foody
// left Israel.
export const CURRENCY_CODE = "ILS";

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
export function currencySymbol(code?: string | null): string {
  if (!code) return CURRENCY_SYMBOLS[CURRENCY_CODE];
  return CURRENCY_SYMBOLS[code.toUpperCase()] || code.toUpperCase();
}

export type FormatMoneyOptions = {
  /** Fraction digits. Default 2. */
  decimals?: number;
  /** Group thousands (1,234.56). Off by default so prices stay compact. */
  grouped?: boolean;
};

/** The bound formatter `useCurrency()` hands out. */
export type MoneyFormatter = (
  amount: number | null | undefined,
  opts?: FormatMoneyOptions,
) => string;

/**
 * Format a price for display, symbol first: `₪12.50`, `€12.50`.
 *
 * Symbol-first for every currency, matching how the admin renders the same
 * amounts — a guest and the restaurant staff looking at one order should not
 * see it laid out two different ways.
 */
export function formatMoney(
  amount: number | null | undefined,
  code?: string | null,
  { decimals = 2, grouped = false }: FormatMoneyOptions = {},
): string {
  const value = Number(amount ?? 0);
  const safe = Number.isFinite(value) ? value : 0;
  const body = grouped
    ? safe.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : safe.toFixed(decimals);
  return `${currencySymbol(code || CURRENCY_CODE)}${body}`;
}
