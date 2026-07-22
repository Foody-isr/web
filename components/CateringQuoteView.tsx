"use client";

import { type CateringQuoteResult } from "@/services/api";
import { useI18n } from "@/lib/i18n";
import { currencySymbol, CURRENCY_CODE } from "@/lib/constants";

const CURRENCY = currencySymbol(CURRENCY_CODE);

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
};

// The server persists `config` as a free-form JSON snapshot (see
// foodyserver/internal/catering/quote.go). Parse it defensively — never
// trust the shape, this is untyped `unknown` on the wire.
function parseConfig(config: unknown): ParsedConfig {
  const parsed: ParsedConfig = { items: [], options: [] };
  if (!config || typeof config !== "object") return parsed;
  const c = config as Record<string, unknown>;

  if (typeof c.guests === "number") parsed.guests = c.guests;
  if (typeof c.event_date === "string") parsed.eventDate = c.event_date;
  if (typeof c.event_type === "string") parsed.eventType = c.event_type;

  if (Array.isArray(c.items)) {
    parsed.items = c.items
      .filter((raw): raw is Record<string, unknown> => !!raw && typeof raw === "object")
      .filter((raw) => typeof raw.name === "string")
      .map((raw) => ({
        catalogItemId: typeof raw.catalog_item_id === "number" ? raw.catalog_item_id : undefined,
        name: raw.name as string,
        unitPrice: typeof raw.unit_price === "number" ? raw.unit_price : undefined,
        quantity: typeof raw.quantity === "number" ? raw.quantity : undefined,
        basis: typeof raw.basis === "string" ? raw.basis : undefined,
        lineTotal: typeof raw.line_total === "number" ? raw.line_total : undefined,
      }));
  }

  if (Array.isArray(c.options)) {
    parsed.options = c.options
      .filter((raw): raw is Record<string, unknown> => !!raw && typeof raw === "object")
      .filter((raw) => typeof raw.name === "string")
      .map((raw) => ({
        optionId: typeof raw.option_id === "number" ? raw.option_id : undefined,
        name: raw.name as string,
        priceMode: typeof raw.price_mode === "string" ? raw.price_mode : undefined,
        price: typeof raw.price === "number" ? raw.price : undefined,
        lineTotal: typeof raw.line_total === "number" ? raw.line_total : undefined,
      }));
  }

  return parsed;
}

type Props = { quote: CateringQuoteResult };

/**
 * Shared read-only render of a catering quote result — an itemized
 * breakdown (or a pending-review message) plus the total. Used by both
 * the in-flow result stage (`CateringExperience`) and the shareable
 * token route (`app/r/[restaurantId]/catering/quote/[token]/page.tsx`).
 */
export function CateringQuoteView({ quote }: Props) {
  const { t } = useI18n();
  const isPending = quote.status === "pending_human_review";
  const config = parseConfig(quote.config);

  return (
    <div>
      <h2 className="text-lg font-bold text-[var(--text)]">
        {isPending ? t("catering_quote_pending") : t("catering_quote_ready")}
      </h2>

      {!isPending && (
        <>
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
            <span className="text-xl font-bold text-brand">{`${CURRENCY}${quote.total}`}</span>
          </div>
        </>
      )}
    </div>
  );
}
