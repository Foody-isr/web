import type { CheckoutFormConfig } from "./types";
import type {
  CustomerCheckoutProfile,
  CustomerCheckoutProfileInput,
} from "../services/api";

function eligibleFields(form: CheckoutFormConfig | null | undefined) {
  return (
    form?.fields.filter(
      (field) =>
        field.enabled && field.kind === "custom" && field.type !== "checkbox",
    ) ?? []
  );
}

/** Remembers enabled text answers without carrying marketing or consent checkboxes forward. */
export function rememberedCheckoutFields(
  form: CheckoutFormConfig | null | undefined,
  values: Record<string, string | boolean>,
): Record<string, string> {
  return Object.fromEntries(
    eligibleFields(form).flatMap((field) => {
      const value = values[field.id];
      return typeof value === "string" ? [[field.id, value]] : [];
    }),
  );
}

/** Restores only currently published fields, preserving even an explicitly cleared answer. */
export function restoreCheckoutFields(
  form: CheckoutFormConfig | null | undefined,
  saved: Record<string, string> | undefined,
  current: Record<string, string | boolean>,
): Record<string, string | boolean> {
  const next = { ...current };
  for (const field of eligibleFields(form)) {
    const value = saved?.[field.id];
    if (typeof value !== "string" || Object.hasOwn(current, field.id)) continue;
    if (
      field.type === "select" &&
      value !== "" &&
      !field.options?.some((option) => option.value === value)
    )
      continue;
    next[field.id] = value;
  }
  return next;
}

/** Compares the current service's remembered details, ignoring renewed proofs and obsolete fields. */
export function hasCheckoutProfileChanges(
  saved: CustomerCheckoutProfile | undefined,
  current: CustomerCheckoutProfileInput,
  form: CheckoutFormConfig | null | undefined,
): boolean {
  if (!saved) return true;
  const name = (value: string) => value.trim().replace(/\s+/gu, " ");
  const phone = (value: string) => value.replace(/\D/gu, "");
  if (
    name(saved.name) !== name(current.name) ||
    phone(saved.phone) !== phone(current.phone)
  )
    return true;
  if (current.delivery) {
    for (const key of [
      "address",
      "city",
      "floor",
      "apt",
      "entry_code",
      "delivery_notes",
    ] as const) {
      if (saved[key].trim() !== current.delivery[key].trim()) return true;
    }
  }
  const fields = restoreCheckoutFields(
    form,
    current.order_type ? saved.custom_fields?.[current.order_type] : undefined,
    {},
  );
  return eligibleFields(form).some(
    (field) =>
      (fields[field.id] ?? "") !== (current.custom_fields?.[field.id] ?? ""),
  );
}
