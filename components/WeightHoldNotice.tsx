"use client";

import { formatMoney } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";

/** Explains the reviewed ceiling without presenting an authorization as a debit. */
export function WeightHoldNotice({ amountMinor, bufferPercent, currency }: { amountMinor: number | null; bufferPercent?: number; currency: string }) {
  const { t } = useI18n();
  return <div className="commerce-notice space-y-3 text-sm" data-weight-hold-notice role="status">
    {amountMinor === null ? <p>{t("weightHoldUnavailable")}</p> : <>
      <div className="flex flex-wrap justify-between gap-2 font-semibold"><span>{t("weightHoldCeiling")}</span><span className="tabular-nums" dir="ltr">{formatMoney(amountMinor / 100, currency)}</span></div>
      <p className="commerce-muted">{t("weightHoldMarginHelp").replace("{percent}", String(bufferPercent))}</p>
      <p>{t("weightHoldSettlementHelp")}</p>
    </>}
  </div>;
}
