"use client";

import type { ConfirmationDeliveryConfig, OrderResponse } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

// Picks a localized string from a { fr, en, he } map, preferring the active
// locale and falling back through en → fr → any present value.
function localized(map: Record<string, string> | undefined, locale: string): string {
  if (!map) return "";
  return map[locale] ?? map.en ?? map.fr ?? Object.values(map)[0] ?? "";
}

/**
 * Delivery section of the post-order confirmation page. Renders (in order):
 *   1. delivery address block (address, city, floor, apt, notes)
 *   2. assigned courier name + tap-to-call phone
 *   3. estimated delivery window
 *   4. an owner-configured reassurance note
 *
 * Each block is gated by the owner's confirmation.delivery flags (defaulting to
 * shown) AND by whether the data exists, so nothing empty is rendered. Until
 * the backend returns courier/delivery fields these simply stay hidden.
 */
export function ConfirmationDeliveryCard({
  order,
  delivery,
}: {
  order: OrderResponse;
  delivery: ConfirmationDeliveryConfig | null;
}) {
  const { t, locale } = useI18n();

  const showDetails = delivery?.show_delivery_details ?? true;
  const showCourier = delivery?.show_courier ?? true;
  const showEta = delivery?.show_eta ?? true;
  const note = localized(delivery?.note, locale);

  const info = order.deliveryInfo;
  const hasAddress = !!(info && (info.address || info.city || info.floor || info.apt || info.notes));
  const hasCourier = !!(order.courierName || order.courierPhone);
  const hasEta = !!(info && (info.etaStart || info.etaEnd));

  // Nothing to show at all → render nothing (no empty card).
  const willRenderAddress = showDetails && hasAddress;
  const willRenderCourier = showCourier && hasCourier;
  const willRenderEta = showEta && hasEta;
  if (!willRenderAddress && !willRenderCourier && !willRenderEta && !note) return null;

  const etaText = info
    ? [info.etaStart, info.etaEnd].filter(Boolean).join(" – ")
    : "";

  return (
    <div className="card p-4 space-y-4">
      {willRenderAddress && (
        <div className="space-y-1.5">
          <h2 className="text-sm font-semibold text-[var(--text)]">{t("deliveryDetails")}</h2>
          {info?.address && (
            <Row label={t("deliveryAddress")} value={info.address} />
          )}
          {info?.city && <Row label={t("deliveryCity")} value={info.city} />}
          {(info?.floor || info?.apt) && (
            <Row
              label={`${t("deliveryFloor")}${info?.apt ? " · " + t("apartment") : ""}`}
              value={[info?.floor, info?.apt].filter(Boolean).join(" · ")}
            />
          )}
          {info?.notes && <Row label={t("deliveryNotes")} value={info.notes} />}
        </div>
      )}

      {willRenderEta && (
        <Row label={t("estimatedDelivery")} value={etaText} strong />
      )}

      {willRenderCourier && (
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="min-w-0">
            <p className="text-xs text-[var(--text-muted)]">{t("courier")}</p>
            {order.courierName && (
              <p className="text-sm font-medium text-[var(--text)] truncate">{order.courierName}</p>
            )}
          </div>
          {order.courierPhone && (
            <a
              href={`tel:${order.courierPhone}`}
              dir="ltr"
              className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-brand/10 text-brand font-semibold text-sm hover:bg-brand/15 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              {order.courierPhone}
            </a>
          )}
        </div>
      )}

      {note && (
        <p className="text-sm text-[var(--text-muted)] leading-relaxed border-t border-[var(--divider)] pt-3">
          {note}
        </p>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-[var(--text-muted)] shrink-0">{label}</span>
      <span className={`text-right ${strong ? "font-semibold text-[var(--text)]" : "text-[var(--text)]"}`}>
        {value}
      </span>
    </div>
  );
}
