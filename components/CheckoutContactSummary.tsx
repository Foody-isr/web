"use client";

import { MapPinIcon, UserCircleIcon } from "@heroicons/react/24/outline";
import { useI18n } from "@/lib/i18n";
import {
  checkoutFieldLabel,
  evaluateVisibility,
  localisedText,
} from "@/lib/checkout-fields";
import type { CheckoutFormConfig } from "@/lib/types";

/** Shows the reviewed contact and delivery details without hiding order-specific consent. */
export function CheckoutContactSummary({
  name,
  phone,
  email,
  delivery,
  form,
  values,
}: {
  name: string;
  phone: string;
  email: string;
  delivery: boolean;
  form: CheckoutFormConfig | null;
  values: Record<string, string | boolean>;
}) {
  const { locale, t } = useI18n();
  const primaryFields = new Set([
    "customer_name",
    "customer_first_name",
    "customer_phone",
    "delivery_address",
    "delivery_city",
  ]);
  const details = form
    ? form.fields.flatMap((field) => {
        const value = values[field.id];
        if (
          !field.enabled ||
          field.type === "checkbox" ||
          primaryFields.has(field.id) ||
          !evaluateVisibility(field.visible_when, values) ||
          typeof value !== "string" ||
          !value.trim()
        )
          return [];
        const display =
          field.type === "select"
            ? localisedText(
                field.options?.find((option) => option.value === value)?.label,
                locale,
              ) || value
            : value;
        return [
          {
            id: field.id,
            label: checkoutFieldLabel(field, locale),
            value: display,
          },
        ];
      })
    : delivery
      ? [
          {
            id: "delivery_floor",
            label: t("floor"),
            value: String(values.delivery_floor || ""),
          },
          {
            id: "delivery_apt",
            label: t("apartment"),
            value: String(values.delivery_apt || ""),
          },
          {
            id: "delivery_entry_code",
            label: t("deliveryEntryCode"),
            value: String(values.delivery_entry_code || ""),
          },
          {
            id: "delivery_notes",
            label: t("deliveryNotes"),
            value: String(values.delivery_notes || ""),
          },
        ].filter((detail) => detail.value.trim())
      : [];
  return (
    <div
      data-checkout-contact-summary
      className="space-y-4 text-sm leading-relaxed text-[var(--text)]"
    >
      <div className="flex items-start gap-3">
        <UserCircleIcon
          aria-hidden="true"
          className="mt-0.5 h-5 w-5 shrink-0 text-[var(--text-muted)]"
        />
        <div className="min-w-0 space-y-0.5">
          <p className="break-words text-base font-medium">
            <bdi>{name}</bdi>
          </p>
          <p className="text-[var(--text-muted)]">
            <bdi dir="ltr">{phone}</bdi>
          </p>
          {email && (
            <p className="break-words text-[var(--text-muted)]">
              <bdi dir="ltr">{email}</bdi>
            </p>
          )}
        </div>
      </div>
      {delivery && (
        <div className="flex items-start gap-3 border-t border-[var(--divider)] pt-4">
          <MapPinIcon
            aria-hidden="true"
            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--text-muted)]"
          />
          <p className="min-w-0 break-words">
            <bdi>
              {[values.delivery_address, values.delivery_city]
                .filter(Boolean)
                .join(", ")}
            </bdi>
          </p>
        </div>
      )}
      {details.length > 0 && (
        <dl className="space-y-1 ps-8 text-[var(--text-muted)]">
          {details.map((detail) => (
            <div key={detail.id} className="break-words">
              <dt className="inline font-medium">
                <bdi>{detail.label}</bdi>:{" "}
              </dt>
              <dd className="inline whitespace-pre-wrap">
                <bdi>{detail.value}</bdi>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
