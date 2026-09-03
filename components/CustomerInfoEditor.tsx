"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { updateGuestOrderDetails, type GuestDetailsInput } from "@/services/api";
import type { CheckoutConfig, OrderResponse } from "@/lib/types";

/**
 * Lets a customer fix their own delivery details from the confirmation page.
 *
 * The reason this exists rather than a phone number: someone who mistyped their
 * building code discovers it when the driver is already downstairs. Reading the
 * details back (CustomerInfoCard) tells them something is wrong; this lets them
 * do something about it.
 *
 * Deliberately narrow. The phone is not here — it is the platform's customer
 * identity key, and changing it would move the order onto somebody else. Nor
 * are the items, the totals or the slot: those cost the restaurant money or
 * kitchen time and stay a staff decision, behind a person.
 *
 * The server refuses once the kitchen has started, which is not a failure to
 * apologise for but a fact to state: past that point a ticket is printed and
 * someone is cooking.
 */

function fieldLabel(
  config: CheckoutConfig | null | undefined,
  id: string,
  locale: string,
): string {
  for (const form of [config?.delivery, config?.pickup]) {
    const field = form?.fields?.find((f) => f.id === id);
    const l = field?.label;
    const resolved = l?.[locale] || l?.en || (l && Object.values(l)[0]);
    if (resolved) return resolved;
  }
  return id
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-page)] px-3 py-2 text-sm"
      />
    </label>
  );
}

export function CustomerInfoEditor({
  order,
  restaurantId,
  token,
  checkoutConfig,
  onSaved,
}: {
  order: OrderResponse;
  restaurantId: string;
  /** The receipt token. Without it the server answers 404, so the control is
   *  not rendered at all. */
  token?: string;
  checkoutConfig?: CheckoutConfig | null;
  onSaved: (order: OrderResponse) => void;
}) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isDelivery = order.orderType === "delivery";
  const customIds = Object.keys(order.customFields ?? {});

  const [form, setForm] = useState<Record<string, string>>(() => ({
    delivery_address: order.deliveryAddress ?? "",
    delivery_city: order.deliveryCity ?? "",
    delivery_floor: order.deliveryFloor ?? "",
    delivery_apt: order.deliveryApt ?? "",
    delivery_entry_code: order.deliveryEntryCode ?? "",
    delivery_notes: order.deliveryNotes ?? "",
    ...Object.fromEntries(
      customIds.map((id) => [`custom:${id}`, String(order.customFields?.[id] ?? "")]),
    ),
  }));

  // No proof of ownership, nothing to edit, or nothing editable: render nothing
  // rather than a control that would only ever fail.
  if (!token || (!isDelivery && customIds.length === 0)) return null;

  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const input: GuestDetailsInput = {};
      if (isDelivery) {
        input.delivery_address = form.delivery_address;
        input.delivery_city = form.delivery_city;
        input.delivery_floor = form.delivery_floor;
        input.delivery_apt = form.delivery_apt;
        input.delivery_entry_code = form.delivery_entry_code;
        input.delivery_notes = form.delivery_notes;
      }
      if (customIds.length > 0) {
        input.custom_fields = Object.fromEntries(
          customIds.map((id) => [id, form[`custom:${id}`] ?? ""]),
        );
      }
      const updated = await updateGuestOrderDetails(order.orderId, restaurantId, token, input);
      onSaved(updated);
      setSaved(true);
      setOpen(false);
    } catch (e) {
      const status = (e as { status?: number }).status;
      // 409 is not a failure to retry — the moment passed. Say what happened
      // and what to do instead.
      setError(status === 409 ? t("informationTooLate") : t("informationSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setSaved(false);
          }}
          className="text-xs font-medium text-brand hover:underline"
        >
          {t("editMyInformation")}
        </button>
        {saved && <span className="text-xs text-[var(--text-muted)]">{t("informationSaved")}</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-2">
      {isDelivery && (
        <>
          <Input label={t("deliveryAddress")} value={form.delivery_address} onChange={set("delivery_address")} />
          <div className="grid grid-cols-2 gap-2">
            <Input label={t("floor")} value={form.delivery_floor} onChange={set("delivery_floor")} />
            <Input label={t("apartment")} value={form.delivery_apt} onChange={set("delivery_apt")} />
          </div>
          <Input label={t("buildingCode")} value={form.delivery_entry_code} onChange={set("delivery_entry_code")} />
          <Input label={t("deliveryNotes")} value={form.delivery_notes} onChange={set("delivery_notes")} />
        </>
      )}

      {customIds.map((id) => (
        <Input
          key={id}
          label={fieldLabel(checkoutConfig, id, locale)}
          value={form[`custom:${id}`] ?? ""}
          onChange={set(`custom:${id}`)}
        />
      ))}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium disabled:opacity-50"
        >
          {t("saveMyInformation")}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
