"use client";

import { useState } from "react";
import { createCateringDeposit, type CateringQuoteResult } from "@/services/api";
import { useI18n } from "@/lib/i18n";
import { currencySymbol, CURRENCY_CODE } from "@/lib/constants";

const CURRENCY = currencySymbol(CURRENCY_CODE);

function formatAmount(value: number): string {
  return value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

type ConfigItemLine = {
  catalogItemId?: number;
  name: string;
  unitPrice?: number;
  quantity?: number;
  basis?: string;
  lineTotal?: number;
};

type ConfigOptionLine = {
  optionId?: number;
  name: string;
  priceMode?: string;
  price?: number;
  lineTotal?: number;
};

type ParsedConfig = {
  guests?: number;
  eventDate?: string | null;
  eventType?: string;
  items: ConfigItemLine[];
  options: ConfigOptionLine[];
  sessions: Array<{
    id: string;
    label: string;
    date?: string;
    guests: number;
    subtotal: number;
    items: ConfigItemLine[];
    options: ConfigOptionLine[];
  }>;
};

function parseItems(value: unknown): ConfigItemLine[] {
  if (!Array.isArray(value)) return [];
  return value.filter((raw): raw is Record<string, unknown> => !!raw && typeof raw === "object" && typeof raw.name === "string").map((raw) => ({
    catalogItemId: typeof raw.catalog_item_id === "number" ? raw.catalog_item_id : undefined,
    name: raw.name as string,
    unitPrice: typeof raw.unit_price === "number" ? raw.unit_price : undefined,
    quantity: typeof raw.quantity === "number" ? raw.quantity : undefined,
    basis: typeof raw.basis === "string" ? raw.basis : undefined,
    lineTotal: typeof raw.line_total === "number" ? raw.line_total : undefined,
  }));
}

function parseOptions(value: unknown): ConfigOptionLine[] {
  if (!Array.isArray(value)) return [];
  return value.filter((raw): raw is Record<string, unknown> => !!raw && typeof raw === "object" && typeof raw.name === "string").map((raw) => ({
    optionId: typeof raw.option_id === "number" ? raw.option_id : undefined,
    name: raw.name as string,
    priceMode: typeof raw.price_mode === "string" ? raw.price_mode : undefined,
    price: typeof raw.price === "number" ? raw.price : undefined,
    lineTotal: typeof raw.line_total === "number" ? raw.line_total : undefined,
  }));
}

// The server persists `config` as a free-form JSON snapshot (see
// foodyserver/internal/catering/quote.go). Parse it defensively — never
// trust the shape, this is untyped `unknown` on the wire.
function parseConfig(config: unknown): ParsedConfig {
  const parsed: ParsedConfig = { items: [], options: [], sessions: [] };
  if (!config || typeof config !== "object") return parsed;
  const c = config as Record<string, unknown>;

  if (typeof c.guests === "number") parsed.guests = c.guests;
  if (typeof c.event_date === "string") parsed.eventDate = c.event_date;
  if (typeof c.event_type === "string") parsed.eventType = c.event_type;

  parsed.items = parseItems(c.items);
  parsed.options = parseOptions(c.options);
  if (Array.isArray(c.sessions)) parsed.sessions = c.sessions.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const session = raw as Record<string, unknown>;
    if (typeof session.id !== "string" || typeof session.subtotal !== "number") return [];
    return [{
      id: session.id,
      label: typeof session.label === "string" ? session.label : session.id,
      date: typeof session.date === "string" ? session.date : undefined,
      guests: typeof session.guests === "number" ? session.guests : 0,
      subtotal: session.subtotal,
      items: parseItems(session.items),
      options: parseOptions(session.options),
    }];
  });

  return parsed;
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
  const { t } = useI18n();
  const isPending = quote.status === "pending_human_review";
  const isApproved = quote.status === "approved" || quote.status === "auto_approved";
  const config = parseConfig(quote.config);

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

      {!isPending && (
        <>
          {config.sessions.length > 0 && <div className="mt-4 space-y-3 border-t border-[var(--divider)] pt-4">{config.sessions.map((session) => <section key={session.id} className="rounded-xl border border-[var(--divider)] bg-[var(--surface-subtle)] p-4 text-start"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-[var(--text)]">{session.label}</p><p className="mt-0.5 text-xs text-[var(--text-muted)]">{session.date}{session.date && session.guests ? " · " : ""}{session.guests ? `${session.guests} ${t("catering_guests_word")}` : ""}</p></div><span className="font-bold tabular-nums text-[var(--text)]">{CURRENCY}{formatAmount(session.subtotal)}</span></div><ul className="mt-3 space-y-1.5 border-t border-[var(--divider)] pt-3 text-sm">{session.items.map((item, index) => <li key={item.catalogItemId ?? index} className="flex justify-between gap-3"><span className="text-[var(--text)]">{item.name}</span>{typeof item.lineTotal === "number" && <span className="text-[var(--text-muted)]">{CURRENCY}{formatAmount(item.lineTotal)}</span>}</li>)}{session.options.map((option, index) => <li key={option.optionId ?? index} className="text-[var(--text-muted)]">+ {option.name}</li>)}</ul></section>)}</div>}
          {(config.items.length > 0 || config.options.length > 0) && (
            <div className="mt-4 space-y-2 border-t border-[var(--divider)] pt-4">
              {config.items.map((item, idx) => (
                <div
                  key={item.catalogItemId ?? idx}
                  className="flex items-start justify-between gap-3 text-start text-sm"
                >
                  <span className="flex flex-col text-[var(--text)]">
                    <span>{item.name}</span>
                    {typeof item.quantity === "number" && typeof item.unitPrice === "number" && (
                      <span className="text-xs text-[var(--text-muted)]">{`${item.quantity} × ${CURRENCY}${item.unitPrice}`}</span>
                    )}
                  </span>
                  {typeof item.lineTotal === "number" && (
                    <span className="whitespace-nowrap font-semibold text-[var(--text)]">{`${CURRENCY}${item.lineTotal}`}</span>
                  )}
                </div>
              ))}
              {config.options.map((option, idx) => (
                <div
                  key={option.optionId ?? idx}
                  className="flex items-start justify-between gap-3 text-start text-sm"
                >
                  <span className="text-[var(--text)]">{option.name}</span>
                  {typeof option.lineTotal === "number" && (
                    <span className="whitespace-nowrap font-semibold text-[var(--text)]">{`${CURRENCY}${option.lineTotal}`}</span>
                  )}
                </div>
              ))}
            </div>
          )}

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

          {isApproved && quote.depositStatus !== "paid" && (
            <div className="mt-4">
              <button
                type="button"
                disabled={paying}
                onClick={handlePayDeposit}
                className="w-full rounded-xl bg-brand py-4 font-bold text-white shadow-lg shadow-brand/30 transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {paying
                  ? t("catering_deposit_processing")
                  : `${t("catering_pay_deposit")}${quote.depositAmount > 0 ? ` ${CURRENCY}${quote.depositAmount.toFixed(2)}` : ""}`}
              </button>
              {payError && <p className="mt-2 text-start text-sm text-red-600">{payError}</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
