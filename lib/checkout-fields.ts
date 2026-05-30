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

// Built-in field IDs the renderer knows how to map to typed Order columns.
// Anything not listed here is treated as a custom field and stored in
// customFields by the caller.
export const BUILTIN_FIELD_IDS = new Set<string>([
  'customer_name',
  'customer_phone',
  'delivery_address',
  'delivery_city',
  'delivery_floor',
  'delivery_apt',
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

// loadGooglePlacesScript injects the Google Maps Places JS once per page load.
// Returns a promise that resolves when window.google.maps.places is available.
// Caller is responsible for handling failures (missing key, blocked network).
let placesLoaderPromise: Promise<void> | null = null;
export function loadGooglePlacesScript(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if ((window as any).google?.maps?.places) return Promise.resolve();
  if (placesLoaderPromise) return placesLoaderPromise;
  placesLoaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=quarterly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      placesLoaderPromise = null;
      reject(new Error('failed to load Google Places script'));
    };
    document.head.appendChild(script);
  });
  return placesLoaderPromise;
}
