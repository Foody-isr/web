// Helpers shared by the checkout page when a restaurant has materialised a
// builder-defined checkout form. When the restaurant has NOT configured a
// form (legacy fallback), these are not used — the checkout page renders its
// hard-coded fields exactly as it did before this feature shipped.

import type {
  CheckoutFieldConfig,
  CheckoutFormConfig,
  CheckoutVisibilityRule,
  OrderType,
  Restaurant,
} from './types';

// Resolve the per-order-type form config from a Restaurant. Returns null when
// the restaurant has no config OR no config for this order type, in which case
// callers MUST fall back to the legacy hard-coded flow.
export function resolveCheckoutForm(
  restaurant: Restaurant | null,
  orderType: OrderType,
): CheckoutFormConfig | null {
  const cfg = restaurant?.websiteConfig?.checkoutConfig ?? null;
  if (!cfg) return null;
  if (orderType === 'delivery') return cfg.delivery ?? null;
  if (orderType === 'pickup') return cfg.pickup ?? null;
  return null;
}

/** Collect a required contact phone independently of the optional SMS policy. */
export function ensureCheckoutPhone(
  form: CheckoutFormConfig | null,
): CheckoutFormConfig | null {
  if (!form) return null;
  const phone = {
    id: "customer_phone",
    kind: "builtin" as const,
    enabled: true,
    required: true,
  };
  const exists = form.fields.some((field) => field.id === phone.id);
  return {
    ...form,
    fields: exists
      ? form.fields.map((field) =>
          field.id === phone.id
            ? {
                ...field,
                enabled: true,
                required: true,
                visible_when: undefined,
              }
            : field,
        )
      : [...form.fields, phone],
  };
}

// Built-in field IDs the renderer knows how to map to typed Order columns.
// Anything not listed here is treated as a custom field and stored in
// customFields by the caller.
export const BUILTIN_FIELD_IDS = new Set<string>([
  'customer_first_name',
  'customer_name',
  'customer_phone',
  'delivery_address',
  'delivery_city',
  'delivery_floor',
  'delivery_apt',
  'delivery_entry_code',
  'delivery_notes',
  'pickup_notes',
]);

// Evaluate one visible_when rule against the current form values. Values are
// keyed by field id. Returns true when the field should render.
export function evaluateVisibility(
  rule: CheckoutVisibilityRule | null | undefined,
  values: Record<string, string | boolean>,
): boolean {
  if (!rule) return true;
  const v = values[rule.field];
  switch (rule.operator) {
    case 'not_empty':
      if (typeof v === 'boolean') return v;
      return typeof v === 'string' && v.trim().length > 0;
    case 'equals':
      return String(v ?? '') === String(rule.value ?? '');
    case 'one_of':
      return (rule.values ?? []).includes(String(v ?? ''));
    default:
      return true;
  }
}

// Pick a localised string from a label/placeholder map. Falls back through
// the requested language, then English, then any present locale.
export function localisedText(
  map: Record<string, string> | undefined,
  locale: string,
): string {
  if (!map) return '';
  return map[locale] ?? map.en ?? map.fr ?? Object.values(map)[0] ?? '';
}

// Returns true when the field is hidden (disabled OR fails its visibility rule).
export function isFieldHidden(
  field: CheckoutFieldConfig,
  values: Record<string, string | boolean>,
): boolean {
  if (!field.enabled) return true;
  return !evaluateVisibility(field.visible_when, values);
}

// Default label fallbacks for built-in fields (when the owner left labels blank).
// Indexed by field id + UI locale (en/he/fr).
const BUILTIN_DEFAULT_LABELS: Record<string, Record<string, string>> = {
  customer_first_name: { en: 'First name',      he: 'שם פרטי',      fr: 'Prénom' },
  customer_name:    { en: 'Full name',         he: 'שם מלא',       fr: 'Nom complet' },
  customer_phone:   { en: 'Phone number',      he: 'טלפון',        fr: 'Téléphone' },
  delivery_address: { en: 'Delivery address',  he: 'כתובת למשלוח', fr: 'Adresse de livraison' },
  delivery_city:    { en: 'City',              he: 'עיר',          fr: 'Ville' },
  delivery_floor:   { en: 'Floor',             he: 'קומה',          fr: 'Étage' },
  delivery_apt:     { en: 'Apartment / unit',  he: 'דירה',          fr: 'Appartement' },
  delivery_entry_code: { en: 'Building code',  he: 'קוד כניסה',     fr: 'Code immeuble' },
  delivery_notes:   { en: 'Delivery notes',    he: 'הערות למשלוח', fr: 'Notes de livraison' },
  pickup_notes:     { en: 'Notes',             he: 'הערות',        fr: 'Notes' },
  whatsapp_number:  { en: 'WhatsApp number (for updates)', he: 'מספר וואטסאפ', fr: 'Numéro WhatsApp (pour les notifications)' },
};

/** Resolves the published field label and the shared localized builtin fallback. */
export function checkoutFieldLabel(field: Pick<CheckoutFieldConfig, "id" | "label">, locale: string): string {
  return localisedText(field.label, locale) || localisedText(BUILTIN_DEFAULT_LABELS[field.id], locale) || field.id;
}
