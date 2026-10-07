"use client";

import { useI18n } from "@/lib/i18n";
import { formatMoney, vatMultiplier } from "@/lib/constants";

/** Totals use Foody's VAT-inclusive pricing and only quote resolved delivery fees. */
export function CommerceOrderSummary({
  subtotal,
  deliveryFee,
  currency,
  vatRate,
  deliveryPending = false,
}: {
  subtotal: number;
  deliveryFee?: number;
  currency: string;
  vatRate: number;
  deliveryPending?: boolean;
}) {
  const { t } = useI18n();
  const total = subtotal + (deliveryFee ?? 0);
  return (
    <div className="commerce-totals space-y-4">
      <div className="flex justify-between gap-4">
        <span>{t("subtotal")}</span>
        <span>{formatMoney(subtotal, currency)}</span>
      </div>
      {deliveryFee !== undefined && (
        <div className="flex justify-between gap-4">
          <span>{t("deliveryFee")}</span>
          <span>{formatMoney(deliveryFee, currency)}</span>
        </div>
      )}
      {deliveryPending && (
        <p className="commerce-muted text-sm">{t("deliveryFeeAtCheckout")}</p>
      )}
      <div className="flex justify-between gap-4 border-t border-dashed border-[var(--divider)] pt-5 font-semibold">
        <span>{t("estimatedOrderTotal")}</span>
        <span>{formatMoney(total, currency)}</span>
      </div>
      <div className="commerce-muted flex justify-between gap-4 text-sm">
        <span>
          {t("vatIncluded")} ({vatRate}%)
        </span>
        <span>
          {formatMoney(total - total / vatMultiplier(vatRate), currency)}
        </span>
      </div>
    </div>
  );
}
