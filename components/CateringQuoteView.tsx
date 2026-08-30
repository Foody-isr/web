"use client";

import { useState } from "react";
import { createCateringDeposit, type CateringQuoteResult } from "@/services/api";
import { useI18n } from "@/lib/i18n";
import { currencySymbol, CURRENCY_CODE } from "@/lib/constants";
import { cateringSessionDate, cateringSessionTitle } from "@/lib/cateringSessionLabels";
import {
  parseCateringQuoteConfig,
  type CateringQuoteFlowSelection,
  type CateringQuoteItemLine,
} from "@/lib/cateringQuote";

const CURRENCY = currencySymbol(CURRENCY_CODE);

function formatAmount(value: number): string {
  return value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function QuoteFlowSelections({ selections }: { selections: CateringQuoteFlowSelection[] }) {
  if (selections.length === 0) return null;
  return (
    <div className="space-y-1.5 text-start text-xs text-[var(--text-muted)]">
      {selections.map((selection, index) => (
        <p key={`${selection.stepId ?? "flow"}-${selection.optionId ?? index}`}>
          <span className="font-semibold text-[var(--text)]">{selection.stepTitle}: </span>
          {selection.quantity > 1 ? `${selection.quantity} × ` : ""}{selection.label}
        </p>
      ))}
    </div>
  );
}

function QuoteItem({ item }: { item: CateringQuoteItemLine }) {
  return (
    <div className="text-start text-sm">
      <div className="flex items-start justify-between gap-3">
        <span className="flex flex-col text-[var(--text)]">
          <span className="font-medium">{item.name}</span>
          {typeof item.quantity === "number" && typeof item.unitPrice === "number" && (
            <span className="text-xs text-[var(--text-muted)]">{`${item.quantity} × ${CURRENCY}${formatAmount(item.unitPrice)}`}</span>
          )}
          {item.pricingRuleLabel && <span className="text-xs text-[var(--text-muted)]">{item.pricingRuleLabel}</span>}
        </span>
        {typeof item.lineTotal === "number" && (
          <span className="whitespace-nowrap font-semibold text-[var(--text)]">{`${CURRENCY}${formatAmount(item.lineTotal)}`}</span>
        )}
      </div>

      {item.includedItems.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 ps-5 text-xs leading-relaxed text-[var(--text-muted)]">
          {item.includedItems.map((included, index) => (
            <li key={included.menuItemId ?? `${included.name}-${index}`}>
              <span className="text-[var(--text)]">{included.name}</span>
              {included.description ? ` — ${included.description}` : ""}
            </li>
          ))}
        </ul>
      )}

      {item.choices.length > 0 && (
        <div className="mt-2 space-y-1 text-xs leading-relaxed text-[var(--text-muted)]">
          {item.choices.map((group, index) => (
            <p key={group.choiceGroupId ?? `${group.name}-${index}`}>
              <span className="font-semibold text-[var(--text)]">{group.name}: </span>
              {group.selections.map((selection) => `${selection.quantity > 1 ? `${selection.quantity} × ` : ""}${selection.name}`).join(", ")}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

type Props = {
  quote: CateringQuoteResult;
  restaurantId: number;
  depositBanner?: "success" | "failed";
};

/**
 * Shared read-only render of a catering quote result — an itemized
 * breakdown (or a pending-review message) plus the total, plus the
 * deposit payment button/paid state for approved quotes. Used by both
 * the in-flow result stage (`CateringExperience`) and the shareable
 * token route (`app/r/[restaurantId]/catering/quote/[token]/page.tsx`).
 */
export function CateringQuoteView({ quote, restaurantId, depositBanner }: Props) {
  const { t, locale } = useI18n();
  const isPending = quote.status === "pending_human_review";
  const isApproved = quote.status === "approved" || quote.status === "auto_approved";
  const config = parseCateringQuoteConfig(quote.config);

  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const handlePayDeposit = async () => {
    setPayError(null);
    setPaying(true);
    try {
      const result = await createCateringDeposit(restaurantId, quote.publicToken);
      window.location.href = result.paymentUrl;
    } catch (err) {
      setPaying(false);
      setPayError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div>
      {depositBanner === "success" && (
        <div className="mb-4 rounded-xl border border-[var(--divider)] bg-[var(--surface-subtle)] px-4 py-3 text-sm text-[var(--text)]">
          {t("catering_deposit_success_banner")}
        </div>
      )}
      {depositBanner === "failed" && (
        <div className="mb-4 rounded-xl border border-[var(--divider)] bg-[var(--surface-subtle)] px-4 py-3 text-sm text-[var(--text)]">
          {t("catering_deposit_failed_banner")}
        </div>
      )}

      <h2 className="text-lg font-bold text-[var(--text)]">
        {isPending ? t("catering_quote_pending") : t("catering_quote_ready")}
      </h2>

      {config.sessions.length > 0 && (
        <div className="mt-4 space-y-3 border-t border-[var(--divider)] pt-4">
          {config.sessions.map((session) => (
            <section key={session.id} className="rounded-xl border border-[var(--divider)] bg-[var(--surface-subtle)] p-4 text-start">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-[var(--text)]">{cateringSessionTitle(session, locale)}</p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {cateringSessionTitle(session, locale) !== cateringSessionDate(session, locale) ? cateringSessionDate(session, locale) : ""}{session.startTime ? ` · ${session.startTime}${session.endTime ? `–${session.endTime}` : ""}` : ""}{session.guests ? ` · ${session.guests} ${t("catering_guests_word")}` : ""}
                  </p>
                </div>
                {!isPending && <span className="font-bold tabular-nums text-[var(--text)]">{CURRENCY}{formatAmount(session.subtotal)}</span>}
              </div>
              <div className="mt-3 space-y-3 border-t border-[var(--divider)] pt-3">
                <QuoteFlowSelections selections={session.flowSelections} />
                {session.items.map((item, index) => <QuoteItem key={item.catalogItemId ?? index} item={item} />)}
                {session.options.map((option, index) => <p key={option.optionId ?? index} className="text-sm text-[var(--text-muted)]">+ {option.name}</p>)}
              </div>
            </section>
          ))}
        </div>
      )}

      {(config.items.length > 0 || config.options.length > 0 || config.flowSelections.some((selection) => !selection.sessionId)) && (
        <div className="mt-4 space-y-3 border-t border-[var(--divider)] pt-4">
          <QuoteFlowSelections selections={config.flowSelections.filter((selection) => !selection.sessionId)} />
          {config.items.map((item, index) => <QuoteItem key={item.catalogItemId ?? index} item={item} />)}
          {config.options.map((option, index) => (
            <div key={option.optionId ?? index} className="flex items-start justify-between gap-3 text-start text-sm">
              <span className="text-[var(--text-muted)]">+ {option.name}</span>
              {!isPending && typeof option.lineTotal === "number" && <span className="whitespace-nowrap font-semibold text-[var(--text)]">{`${CURRENCY}${formatAmount(option.lineTotal)}`}</span>}
            </div>
          ))}
        </div>
      )}

      {!isPending && (
        <>
          <div className="mt-4 flex items-center justify-between border-t border-[var(--divider)] pt-4">
            <span className="text-sm text-[var(--text-muted)]">{t("catering_quote_total")}</span>
            <span className="text-xl font-bold text-brand">{`${CURRENCY}${formatAmount(quote.total)}`}</span>
          </div>
          {quote.guests > 0 && <div className="mt-1.5 flex items-center justify-between gap-3 text-sm"><span className="text-[var(--text-muted)]">{t("catering_total_per_guest")}</span><span className="font-semibold tabular-nums text-[var(--text)]">{`${CURRENCY}${formatAmount(quote.total / quote.guests)}`}</span></div>}
          {config.sessions.length > 1 && config.sessions.some((session) => session.guests > 0) && <div className="mt-1.5 flex items-center justify-between gap-3 text-xs"><span className="text-[var(--text-muted)]">{t("catering_average_per_guest_session")}</span><span className="font-medium tabular-nums text-[var(--text-muted)]">{`${CURRENCY}${formatAmount(quote.total / config.sessions.reduce((sum, session) => sum + session.guests, 0))}`}</span></div>}

          {isApproved && quote.depositStatus === "paid" && (
            <div className="mt-4 rounded-xl border border-[var(--divider)] bg-[var(--surface-subtle)] px-4 py-3 text-start text-sm">
              <p className="font-semibold text-[var(--text)]">{t("catering_deposit_paid")}</p>
              <p className="mt-1 text-[var(--text-muted)]">{`${t("catering_deposit_amount")}: ${CURRENCY}${quote.depositAmount.toFixed(2)}`}</p>
            </div>
          )}

          {isApproved && (quote.depositStatus === "none" || quote.depositStatus === "pending") && quote.depositAmount > 0 && (
            <div className="mt-4">
              <button
                type="button"
                disabled={paying}
                onClick={handlePayDeposit}
                className="w-full rounded-xl bg-brand py-4 font-bold text-white shadow-lg shadow-brand/30 transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {paying
                  ? t("catering_deposit_processing")
                  : `${t("catering_pay_deposit")} ${CURRENCY}${quote.depositAmount.toFixed(2)}`}
              </button>
              {payError && <p className="mt-2 text-start text-sm text-red-600">{payError}</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
