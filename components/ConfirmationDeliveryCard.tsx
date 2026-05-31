"use client";

import type { OrderDeliveryInfo, OrderType } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

type Props = {
  delivery?: OrderDeliveryInfo | null;
  orderType?: OrderType;
};

/**
 * Formats an ETA value for display. Accepts either an ISO8601 timestamp or a
 * bare "HH:MM" string and returns a locale-aware "HH:MM". Falls back to the
 * raw value if it can't be parsed so we never show "Invalid Date".
 */
function formatEta(value?: string): string | null {
  if (!value) return null;
  // Bare "HH:MM" — show as-is.
  if (/^\d{1,2}:\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * ConfirmationDeliveryCard shows courier + ETA info for delivery orders on the
 * post-order confirmation page. Every field is gated on presence, and the
 * whole card disappears when there's nothing to show — so it stays invisible
 * until the backend starts populating `external_metadata.delivery`.
 */
export function ConfirmationDeliveryCard({ delivery, orderType }: Props) {
  const { t } = useI18n();

  if (orderType !== "delivery" || !delivery) return null;

  const { courierName, courierPhone, note } = delivery;
  const etaStart = formatEta(delivery.etaStart);
  const etaEnd = formatEta(delivery.etaEnd);
  const eta = etaStart && etaEnd ? `${etaStart} – ${etaEnd}` : etaStart || etaEnd;

  // Nothing worth rendering — bail so we don't show an empty card.
  if (!courierName && !courierPhone && !eta && !note) return null;

  const telHref = courierPhone ? `tel:${courierPhone.replace(/\s/g, "")}` : null;

  return (
    <div className="card p-4 space-y-3">
      <h3 className="text-sm font-semibold text-[var(--text)]">
        {t("deliveryInfoTitle")}
      </h3>

      <div className="space-y-2.5">
        {courierName && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--surface-subtle)] flex items-center justify-center text-sm font-bold text-brand">
              {courierName.trim().charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[var(--text-muted)]">{t("courierName")}</p>
              <p className="text-sm font-medium truncate">{courierName}</p>
            </div>
          </div>
        )}

        {telHref && (
          <a
            href={telHref}
            className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[var(--surface-subtle)] hover:bg-brand/10 transition text-sm"
          >
            <span className="text-[var(--text-muted)]">{t("callCourier")}</span>
            <span className="text-brand font-medium" dir="ltr">{courierPhone}</span>
          </a>
        )}

        {eta && (
          <div className="px-3 py-2.5 rounded-lg bg-[var(--surface-subtle)]">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">
              {t("eta")}
            </p>
            <p className="text-sm font-medium text-[var(--text)]">{eta}</p>
          </div>
        )}

        {note && (
          <div className="px-3 py-2.5 rounded-lg bg-[var(--surface-subtle)] border-l-2 border-brand">
            <p className="text-sm text-[var(--text)]">{note}</p>
          </div>
        )}
      </div>
    </div>
  );
}
