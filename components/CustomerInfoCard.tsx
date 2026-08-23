"use client";

import { useI18n } from "@/lib/i18n";
import type { CheckoutConfig } from "@/lib/types";

/**
 * "Your information" — what the customer typed at checkout, read back to them.
 *
 * None of this reached the customer before. The delivery address and the
 * answers to the restaurant's custom checkout fields lived on the order, showed
 * up in the admin's customer card, and appeared on no customer-facing surface
 * at all: not this page, not the receipt, not the server's message templates.
 * Someone who mistyped their building code found out when the driver called.
 *
 * Labels for the custom fields come from the restaurant's own checkout form, in
 * the language the customer is reading — the owner writes them per locale.
 */

/** Turn a snake_case field id into a readable fallback ("code_immeuble" →
 *  "Code Immeuble"). Only used when the owner left every locale blank, or when
 *  the field has since been deleted from the form. */
function humanizeFieldId(id: string): string {
  return id
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ")
    .trim();
}

/** Best label for a checkout field: the reader's locale, then any the owner
 *  filled in, then the humanized id. */
function fieldLabel(
  config: CheckoutConfig | null | undefined,
  id: string,
  locale: string,
): string {
  for (const form of [config?.delivery, config?.pickup]) {
    const field = form?.fields?.find((f) => f.id === id);
    if (!field) continue;
    const l = field.label;
    const resolved = l?.[locale] || l?.en || (l && Object.values(l)[0]);
    if (resolved) return resolved;
  }
  return humanizeFieldId(id);
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-[var(--text-muted)] shrink-0">{label}</span>
      <span className="text-end font-medium break-words min-w-0">{value}</span>
    </div>
  );
}

export interface CustomerInfoCardProps {
  /** Address parts. Omit them entirely to render a custom-fields-only card —
   *  that is what the receipt does, since it is a shareable link and already
   *  masks the phone for the same reason. */
  address?: {
    street?: string;
    city?: string;
    floor?: string;
    apt?: string;
    entryCode?: string;
    notes?: string;
  };
  customFields?: Record<string, string | number | boolean> | null;
  checkoutConfig?: CheckoutConfig | null;
  /** "Spotted a mistake? Call us." Worth saying while the order can still
   *  be changed; on a receipt the order is already delivered, so it is off
   *  by default there. */
  showHint?: boolean;
}

export function CustomerInfoCard({
  address,
  customFields,
  checkoutConfig,
  showHint = true,
}: CustomerInfoCardProps) {
  const { t, locale } = useI18n();

  const street = [address?.street, address?.city]
    .map((v) => (v || "").trim())
    .filter(Boolean)
    .join(", ");

  const unit = [
    address?.floor?.trim() ? `${t("floor")} ${address.floor.trim()}` : "",
    address?.apt?.trim() ? `${t("apartment")} ${address.apt.trim()}` : "",
    address?.entryCode?.trim() ? `${t("buildingCode")} ${address.entryCode.trim()}` : "",
  ]
    .filter(Boolean)
    .join(", ");

  const customRows = Object.entries(customFields ?? {})
    // The server already drops empty answers, but a `false` checkbox survives
    // and means "not selected" — showing it would invent an answer.
    .filter(([, v]) => v !== "" && v !== false && v != null)
    .map(([id, v]) => ({
      id,
      label: fieldLabel(checkoutConfig, id, locale),
      value: typeof v === "boolean" ? "✓" : String(v),
    }));

  const hasAddress = Boolean(street || unit);
  const notes = address?.notes?.trim();
  if (!hasAddress && !notes && customRows.length === 0) return null;

  return (
    <div className="card p-4 space-y-2">
      <div className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
        {t("yourInformation")}
      </div>

      {hasAddress && (
        <Row label={t("deliveryAddress")} value={unit ? `${street} (${unit})` : street} />
      )}
      {notes && <Row label={t("deliveryNotes")} value={notes} />}
      {customRows.map((r) => (
        <Row key={r.id} label={r.label} value={r.value} />
      ))}

      {showHint && (
        <p className="text-xs text-[var(--text-muted)] pt-1">{t("yourInformationHint")}</p>
      )}
    </div>
  );
}
