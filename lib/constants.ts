// A restaurant carries its own VAT rate (`Restaurant.vatRate`, a percentage
// such as 18 or 20 — the same shape the admin edits and the API stores). These
// are the fallback for restaurants that predate the field: Israel's 18%.
//
// The rate is not cosmetic. It is shown to the guest as a tax breakdown at
// checkout and on the receipt, so a wrong one is a wrong fiscal statement, not
// a rounding difference.
export const VAT_RATE_PERCENT = 18;
export const VAT_RATE = VAT_RATE_PERCENT / 100;

/** Percentage (18) to the multiplier prices are inclusive of (1.18). */
export function vatMultiplier(ratePercent?: number | null): number {
  const pct = Number(ratePercent ?? VAT_RATE_PERCENT);
  return 1 + (Number.isFinite(pct) ? pct : VAT_RATE_PERCENT) / 100;
}

/**
 * Split a VAT-inclusive total into what the restaurant keeps and what it owes.
 * `ratePercent` is the restaurant's rate; omitting it falls back to Israel's.
 */
export function calculateVAT(total: number, ratePercent?: number | null) {
  const subtotal = total / vatMultiplier(ratePercent);
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
