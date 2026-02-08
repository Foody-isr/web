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
