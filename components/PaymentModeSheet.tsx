"use client";

import { useI18n } from "@/lib/i18n";
import { CURRENCY_SYMBOL } from "@/lib/constants";
import { SessionPaymentMode } from "@/services/api";
import { useState } from "react";

const TIP_OPTIONS = [0, 5, 10, 12, 15, 20]; // percentages

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (mode: SessionPaymentMode, splitCount?: number, tipAmount?: number) => void;
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
  const [step, setStep] = useState<"mode" | "tip">("mode");
  const [selectedMode, setSelectedMode] = useState<SessionPaymentMode>("my_orders");
  const [selectedSplitCount, setSelectedSplitCount] = useState(2);
  const [tipPercent, setTipPercent] = useState<number>(0);

  const splitAmount = tableTotal / splitCount;

  // Base amount that the user will pay (before tip)
  const baseAmount =
    selectedMode === "my_orders"
      ? myUnpaidTotal
      : selectedMode === "split_equal"
      ? tableTotal / selectedSplitCount
      : tableTotal;

  const tipAmount = Math.round(baseAmount * tipPercent) / 100;
  const totalWithTip = baseAmount + tipAmount;

  function handleModeSelect(mode: SessionPaymentMode, sc?: number) {
    setSelectedMode(mode);
    setSelectedSplitCount(sc || 2);
    setTipPercent(0);
    setStep("tip");
  }

  function handleBack() {
    setStep("mode");
    setTipPercent(0);
  }

  function handleConfirm() {
    onConfirm(
      selectedMode,
      selectedMode === "split_equal" ? selectedSplitCount : undefined,
      tipAmount > 0 ? tipAmount : undefined
    );
  }

  function handleClose() {
    setStep("mode");
    setTipPercent(0);
    onClose();
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={handleClose}
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

        {step === "mode" ? (
          /* ======================== STEP 1: Payment Mode ======================== */
          <>
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
                  onClick={() => handleModeSelect("my_orders")}
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
                onClick={() => handleModeSelect("full_table")}
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
                        onClick={() => handleModeSelect("split_equal", splitCount)}
                        disabled={isLoading}
                        className="px-5 py-2.5 rounded-xl bg-brand text-white font-bold shadow-lg shadow-brand/30 hover:bg-brand-dark transition disabled:opacity-50"
                      >
                        {t("payMyShare") || "Pay my share"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Cancel */}
            <div className="px-5 py-4 border-t border-[var(--divider)] bg-[var(--surface)]">
              <button
                onClick={handleClose}
                className="w-full py-3 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-xl transition-colors"
              >
                {t("cancel") || "Cancel"}
              </button>
            </div>
          </>
        ) : (
          /* ======================== STEP 2: Tip Selection ======================== */
          <>
            {/* Header */}
            <div className="px-5 pb-4 pt-2 border-b border-[var(--divider)]">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBack}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--surface-hover)] transition-colors"
                >
                  <span className="text-lg">{direction === "rtl" ? "→" : "←"}</span>
                </button>
                <div>
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">
                    🙏 {t("addTip") || "Add a tip"}
                  </h2>
                  <p className="text-sm text-[var(--text-soft)] mt-0.5">
                    {t("tipDescription") || "Show your appreciation for great service"}
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-5 space-y-6">
              {/* Tip pills */}
              <div className="grid grid-cols-3 gap-2.5">
                {TIP_OPTIONS.map((pct) => {
                  const isSelected = tipPercent === pct;
                  const amount = Math.round(baseAmount * pct) / 100;
                  return (
                    <button
                      key={pct}
                      onClick={() => setTipPercent(pct)}
                      className={`
                        relative py-3 px-2 rounded-2xl border-2 transition-all text-center
                        ${
                          isSelected
                            ? "border-brand bg-brand/10 shadow-md shadow-brand/20"
                            : "border-[var(--divider)] bg-[var(--surface-subtle)] hover:border-brand/30"
                        }
                      `}
                    >
                      {pct === 0 ? (
                        <>
                          <p className={`text-base font-bold ${isSelected ? "text-brand" : "text-[var(--text-primary)]"}`}>
                            {t("noTip") || "No tip"}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className={`text-xl font-bold ${isSelected ? "text-brand" : "text-[var(--text-primary)]"}`}>
                            {pct}%
                          </p>
                          <p className={`text-xs mt-0.5 ${isSelected ? "text-brand/80" : "text-[var(--text-muted)]"}`}>
                            {CURRENCY_SYMBOL}{amount.toFixed(2)}
                          </p>
                        </>
                      )}
                      {isSelected && (
                        <div className="absolute -top-1 -end-1 w-5 h-5 bg-brand rounded-full flex items-center justify-center">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Summary card */}
              <div className="bg-[var(--surface-subtle)] rounded-2xl p-4 space-y-2.5 border border-[var(--divider)]">
                <div className="flex justify-between text-sm text-[var(--text-muted)]">
                  <span>{t("subtotal") || "Subtotal"}</span>
                  <span>{CURRENCY_SYMBOL}{baseAmount.toFixed(2)}</span>
                </div>
                {tipAmount > 0 && (
                  <div className="flex justify-between text-sm text-brand font-medium">
                    <span>{t("tip") || "Tip"} ({tipPercent}%)</span>
                    <span>+{CURRENCY_SYMBOL}{tipAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-[var(--divider)] pt-2.5 flex justify-between">
                  <span className="font-bold text-[var(--text-primary)]">
                    {t("totalToPay") || "Total to pay"}
                  </span>
                  <span className="font-bold text-xl text-brand">
                    {CURRENCY_SYMBOL}{totalWithTip.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Confirm button */}
            <div className="px-5 py-4 border-t border-[var(--divider)] bg-[var(--surface)] space-y-2">
              <button
                onClick={handleConfirm}
                disabled={isLoading}
                className="w-full py-3.5 rounded-2xl bg-brand text-white font-bold text-base shadow-lg shadow-brand/30 hover:bg-brand-dark transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    💳 {t("proceedToPayment") || "Proceed to payment"} · {CURRENCY_SYMBOL}{totalWithTip.toFixed(2)}
                  </>
                )}
              </button>
              <button
                onClick={handleClose}
                className="w-full py-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-xl transition-colors"
              >
                {t("cancel") || "Cancel"}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
