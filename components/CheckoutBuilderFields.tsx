'use client';

import { useMemo } from 'react';
import { DeliveryAddressAutocomplete } from '@/components/DeliveryAddressAutocomplete';
import type { DeliveryAddressSuggestion } from '@/services/api';
import { useI18n } from '@/lib/i18n';
import {
  BUILTIN_FIELD_IDS,
  evaluateVisibility,
  localisedText,
} from '@/lib/checkout-fields';
import type { CheckoutFieldConfig, CheckoutFormConfig } from '@/lib/types';

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

// Delivery address-related fields that stay hidden until a city is selected, so
// the customer chooses their city before filling in the rest of the address.
const CITY_GATED_FIELD_IDS = new Set<string>([
  'delivery_address',
  'delivery_floor',
  'delivery_apt',
  'delivery_entry_code',
  'delivery_notes',
]);

interface BuilderState {
  customerFirstName: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryFloor: string;
  deliveryApt: string;
  deliveryEntryCode: string;
  deliveryNotes: string;
  pickupNotes: string;
  customFields: Record<string, string | boolean>;
}

export interface CheckoutBuilderFieldsProps {
  form: CheckoutFormConfig;
  state: BuilderState;
  onBuiltinChange: (id: string, value: string) => void;
  onCustomChange: (id: string, value: string | boolean) => void;
  restaurantId: string;
  autocompleteEnabled: boolean;
  addressSelectionToken?: string;
  /** The selected street and city are already shown in the editable summary. */
  addressInSummary?: boolean;
  onAddressSelected: (suggestion: DeliveryAddressSuggestion) => void;
  countrySelect?: React.ReactNode;
  /** List of delivery cities from the restaurant config. When non-empty, the
   *  delivery_city builtin field renders as a dropdown instead of a text input. */
  cityOptions?: string[];
  /** Optional extra content rendered immediately after a given field, by id.
   *  Used to surface the delivery fee right under the city field. */
  renderAfterField?: (fieldId: string) => React.ReactNode;
}

/**
 * Renders the checkout details form from a builder-defined CheckoutFormConfig.
 *
 * Each field is shown in the order configured by the owner. Built-in fields
 * map to the typed state on the parent (customer_name, delivery_address, etc.);
 * custom fields go into state.customFields keyed by field id.
 *
 * Delivery address selections include a signed point for the delivery module.
 */
export default function CheckoutBuilderFields({
  form, state, onBuiltinChange, onCustomChange, onAddressSelected,
  restaurantId, autocompleteEnabled, addressSelectionToken, addressInSummary, countrySelect, cityOptions, renderAfterField,
}: CheckoutBuilderFieldsProps) {
  const { locale } = useI18n();

  // Mirror current state into an id->value map for visibility evaluation.
  // Booleans for checkbox-typed custom fields; strings everywhere else.
  const valuesById = useMemo(() => {
    const m: Record<string, string | boolean> = {
      customer_first_name: state.customerFirstName,
      customer_name:    state.customerName,
      customer_phone:   state.customerPhone,
      delivery_address: state.deliveryAddress,
      delivery_city:    state.deliveryCity,
      delivery_floor:   state.deliveryFloor,
      delivery_apt:     state.deliveryApt,
      delivery_entry_code: state.deliveryEntryCode,
      delivery_notes:   state.deliveryNotes,
      pickup_notes:     state.pickupNotes,
    };
    for (const [k, v] of Object.entries(state.customFields)) m[k] = v;
    return m;
  }, [state]);

  // Hide the address fields until a city is chosen. Only active when the form
  // actually has an enabled delivery_city field — otherwise these fields would
  // never appear (e.g. an address-autocomplete-only form with no city field).
  const cityGateActive = useMemo(
    () =>
      !autocompleteEnabled && form.fields.some((f) => f.id === 'delivery_city' && f.enabled) &&
      String(state.deliveryCity ?? '').trim().length === 0,
    [form.fields, state.deliveryCity, autocompleteEnabled],
  );

  return (
    <div className="space-y-4">
      {form.fields.map((field) => {
        if (!field.enabled) return null;
        if (addressInSummary && addressSelectionToken && (field.id === 'delivery_address' || field.id === 'delivery_city')) return null;
        if (cityGateActive && CITY_GATED_FIELD_IDS.has(field.id)) return null;
        if (!evaluateVisibility(field.visible_when ?? null, valuesById)) return null;
        const after = renderAfterField?.(field.id);
        return (
          <div key={field.id} className="space-y-4">
            {field.id === 'delivery_address' ? <div>
              <Label text={localisedText(field.label, locale) || localisedText(BUILTIN_DEFAULT_LABELS.delivery_address, locale)} required={field.required} />
              <DeliveryAddressAutocomplete restaurantId={restaurantId} enabled={autocompleteEnabled} value={state.deliveryAddress}
                label={localisedText(BUILTIN_DEFAULT_LABELS.delivery_address, locale)} placeholder={localisedText(field.placeholder, locale)} required={field.required}
                selectionToken={addressSelectionToken} selectionCity={state.deliveryCity} onChange={v => onBuiltinChange('delivery_address', v)} onSelect={onAddressSelected} />
            </div> : <FieldRow
              field={field}
              locale={locale}
              value={(valuesById[field.id] as string | boolean) ?? (field.type === 'checkbox' ? false : '')}
              onChange={(v) => {
                if (BUILTIN_FIELD_IDS.has(field.id)) onBuiltinChange(field.id, String(v));
                else onCustomChange(field.id, v);
              }}
              countrySelect={field.id === 'customer_phone' ? countrySelect : undefined}
              cityOptions={field.id === 'delivery_city' && !autocompleteEnabled ? cityOptions : undefined}
            />}
            {after}
          </div>
        );
      })}
    </div>
  );
}

function FieldRow({
  field, locale, value, onChange, countrySelect, cityOptions,
}: {
  field: CheckoutFieldConfig;
  locale: string;
  value: string | boolean;
  onChange: (v: string | boolean) => void;
  countrySelect?: React.ReactNode;
  cityOptions?: string[];
}) {
  const { t } = useI18n();
  const label = (
    localisedText(field.label, locale)
    || localisedText(BUILTIN_DEFAULT_LABELS[field.id], locale)
    || field.id
  );
  const placeholder = localisedText(field.placeholder, locale);
  const type = field.type ?? (field.kind === 'builtin' ? builtinDefaultType(field.id) : 'text');

  // When city options are provided for delivery_city, render a dropdown
  if (field.id === 'delivery_city' && cityOptions && cityOptions.length > 0) {
    return (
      <div>
        <Label text={label} required={field.required} />
        <select
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className="w-full px-4 py-3 border border-[var(--divider)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-[var(--surface)] text-[var(--checkout-input,var(--text))]"
        >
          <option value="" disabled>{t('chooseCity') || 'Choisir une ville'}</option>
          {cityOptions.map((city) => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>
      </div>
    );
  }

  if (type === 'checkbox') {
    return (
      <label className="flex items-start gap-3 p-3 rounded-xl bg-[var(--surface-subtle)] cursor-pointer">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 w-4 h-4"
        />
        <span className="text-sm text-[var(--text)]">
          {label}
          {field.required && <span className="text-amber-600 ml-1">*</span>}
        </span>
      </label>
    );
  }

  if (type === 'select') {
    return (
      <div>
        <Label text={label} required={field.required} />
        <select
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className="w-full px-4 py-3 border border-[var(--divider)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-[var(--surface)] text-[var(--checkout-input,var(--text))]"
        >
          <option value="">--</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {localisedText(opt.label, locale) || opt.value}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (type === 'textarea') {
    return (
      <div>
        <Label text={label} required={field.required} />
        <textarea
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          rows={2}
          placeholder={placeholder}
          className="w-full px-4 py-3 border border-[var(--divider)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-[var(--surface)] text-[var(--checkout-input,var(--text))] resize-none"
        />
      </div>
    );
  }

  // phone gets the country-code select inline if the parent provided one
  if (type === 'tel' && countrySelect) {
    return (
      <div>
        <Label text={label} required={field.required} />
        <div className="flex gap-2" dir="ltr">
          {countrySelect}
          <input
            type="tel"
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            placeholder={placeholder || '50-123-4567'}
            className="min-w-0 flex-1 px-4 py-3 border border-[var(--divider)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-[var(--surface)] text-[var(--checkout-input,var(--text))]"
          />
        </div>
      </div>
    );
  }

  // text / tel without countrySelect / email
  return (
    <div>
      <Label text={label} required={field.required} />
      <input
        type={type === 'email' ? 'email' : type === 'tel' ? 'tel' : 'text'}
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
        placeholder={placeholder}
        className="w-full px-4 py-3 border border-[var(--divider)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-[var(--surface)] text-[var(--checkout-input,var(--text))]"
      />
    </div>
  );
}

function Label({ text, required }: { text: string; required: boolean }) {
  return (
    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
      {text} {required && '*'}
    </label>
  );
}

function builtinDefaultType(id: string): 'text' | 'tel' | 'textarea' {
  if (id === 'customer_phone' || id === 'whatsapp_number') return 'tel';
  if (id === 'delivery_notes' || id === 'pickup_notes') return 'textarea';
  return 'text';
}
