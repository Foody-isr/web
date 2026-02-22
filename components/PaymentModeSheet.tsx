"use client";

import { useI18n } from "@/lib/i18n";
import { CURRENCY_SYMBOL } from "@/lib/constants";
import { SessionPaymentMode } from "@/services/api";
import { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (mode: SessionPaymentMode, splitCount?: number) => void;
  myUnpaidTotal: number;
  tableTotal: number;
  guestCount: number;
  isLoading?: boolean;
};

export function PaymentModeSheet({
  open,
  onClose,
  onConfirm,
  myUnpaidTotal,
  tableTotal,
  guestCount,
  isLoading,
}: Props) {
  const { t, direction } = useI18n();
  const [splitCount, setSplitCount] = useState(guestCount >= 2 ? guestCount : 2);
  const splitAmount = tableTotal / splitCount;

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[101] bg-[var(--surface)] rounded-t-3xl shadow-2xl max-h-[80vh] flex flex-col animate-in slide-in-from-bottom duration-300"
        dir={direction}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[var(--divider)]" />
        </div>

        {/* Header */}
        <div className="px-5 pb-4 pt-2 border-b border-[var(--divider)]">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            💳 {t("howToPay") || "How would you like to pay?"}
          </h2>
          <p className="text-sm text-[var(--text-soft)] mt-1">
            {t("choosePaymentMode") || "Choose how to settle the bill"}
          </p>
        </div>

        {/* Options */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          {/* Option 1: Pay for my orders */}
          {myUnpaidTotal > 0 && (
            <button
              onClick={() => onConfirm("my_orders")}
              disabled={isLoading}
              className="w-full p-4 rounded-2xl border-2 border-[var(--divider)] hover:border-brand/50 bg-[var(--surface-subtle)] hover:bg-brand/5 transition-all text-start disabled:opacity-50"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">🙋</span>
                <div className="flex-1">
                  <p className="font-bold text-[var(--text-primary)]">
                    {t("payMyOrders") || "Pay for my orders"}
                  </p>
                  <p className="text-sm text-[var(--text-muted)] mt-0.5">
                    {t("payMyOrdersDesc") || "Only pay for what you ordered"}
                  </p>
                  <p className="text-lg font-bold text-brand mt-2">
                    {CURRENCY_SYMBOL}{myUnpaidTotal.toFixed(2)}
                  </p>
                </div>
              </div>
            </button>
          )}

          {/* Option 2: Pay for the whole table */}
          <button
            onClick={() => onConfirm("full_table")}
            disabled={isLoading}
            className="w-full p-4 rounded-2xl border-2 border-[var(--divider)] hover:border-brand/50 bg-[var(--surface-subtle)] hover:bg-brand/5 transition-all text-start disabled:opacity-50"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">🎂</span>
              <div className="flex-1">
                <p className="font-bold text-[var(--text-primary)]">
                  {t("payForTable") || "Pay for the whole table"}
                </p>
                <p className="text-sm text-[var(--text-muted)] mt-0.5">
                  {t("payForTableFullDesc") || "Treat everyone — you cover the full bill"}
                </p>
                <p className="text-lg font-bold text-brand mt-2">
                  {CURRENCY_SYMBOL}{tableTotal.toFixed(2)}
                </p>
              </div>
            </div>
          </button>

          {/* Option 3: Split equally */}
          <div className="w-full p-4 rounded-2xl border-2 border-[var(--divider)] bg-[var(--surface-subtle)]">
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">✂️</span>
              <div className="flex-1">
                <p className="font-bold text-[var(--text-primary)]">
                  {t("splitEqually") || "Split equally"}
                </p>
                <p className="text-sm text-[var(--text-muted)] mt-0.5">
                  {t("splitEquallyDesc") || "Divide the total bill equally"}
                </p>

                {/* Split count selector */}
                <div className="flex items-center gap-3 mt-3">
                  <span className="text-sm text-[var(--text-muted)]">
                    {t("splitBy") || "Split by"}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSplitCount(Math.max(2, splitCount - 1))}
                      className="w-8 h-8 rounded-full bg-[var(--surface)] border border-[var(--divider)] flex items-center justify-center text-[var(--text-primary)] font-bold hover:bg-[var(--surface-hover)] transition"
                    >
                      −
                    </button>
                    <span className="w-8 text-center font-bold text-lg text-[var(--text-primary)]">
                      {splitCount}
                    </span>
                    <button
                      onClick={() => setSplitCount(Math.min(20, splitCount + 1))}
                      className="w-8 h-8 rounded-full bg-[var(--surface)] border border-[var(--divider)] flex items-center justify-center text-[var(--text-primary)] font-bold hover:bg-[var(--surface-hover)] transition"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-sm text-[var(--text-muted)]">
                    {t("people") || "people"}
                  </span>
                </div>

                <div className="flex items-center justify-between mt-3">
                  <p className="text-lg font-bold text-brand">
                    {CURRENCY_SYMBOL}{splitAmount.toFixed(2)}
                    <span className="text-sm font-normal text-[var(--text-muted)] ms-1">
                      / {t("person") || "person"}
                    </span>
                  </p>
                  <button
                    onClick={() => onConfirm("split_equal", splitCount)}
                    disabled={isLoading}
                    className="px-5 py-2.5 rounded-xl bg-brand text-white font-bold shadow-lg shadow-brand/30 hover:bg-brand-dark transition disabled:opacity-50"
                  >
                    {isLoading ? "..." : t("payMyShare") || "Pay my share"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cancel */}
        <div className="px-5 py-4 border-t border-[var(--divider)] bg-[var(--surface)]">
          <button
            onClick={onClose}
            className="w-full py-3 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-xl transition-colors"
          >
            {t("cancel") || "Cancel"}
          </button>
        </div>
      </div>
    </>
  );
}
