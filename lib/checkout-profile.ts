import type { CheckoutFormConfig } from "./types";

function eligibleFields(form: CheckoutFormConfig | null | undefined) {
  return form?.fields.filter(field => field.enabled && field.kind === "custom" && field.type !== "checkbox") ?? [];
}

/** Remembers enabled text answers without carrying marketing or consent checkboxes forward. */
export function rememberedCheckoutFields(form: CheckoutFormConfig | null | undefined, values: Record<string, string | boolean>): Record<string, string> {
  return Object.fromEntries(eligibleFields(form).flatMap(field => {
    const value = values[field.id];
    return typeof value === "string" ? [[field.id, value]] : [];
  }));
}

/** Restores only currently published fields, preserving even an explicitly cleared answer. */
export function restoreCheckoutFields(form: CheckoutFormConfig | null | undefined, saved: Record<string, string> | undefined, current: Record<string, string | boolean>): Record<string, string | boolean> {
  const next = { ...current };
  for (const field of eligibleFields(form)) {
    const value = saved?.[field.id];
    if (typeof value !== "string" || Object.hasOwn(current, field.id)) continue;
    if (field.type === "select" && value !== "" && !field.options?.some(option => option.value === value)) continue;
    next[field.id] = value;
  }
  return next;
}
