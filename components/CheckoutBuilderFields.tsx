'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useI18n } from '@/lib/i18n';
import {
  BUILTIN_FIELD_IDS,
  evaluateVisibility,
  loadGooglePlacesScript,
  localisedText,
} from '@/lib/checkout-fields';
import type { CheckoutFieldConfig, CheckoutFormConfig } from '@/lib/types';

// Default label fallbacks for built-in fields (when the owner left labels blank).
// Indexed by field id + UI locale (en/he/fr).
const BUILTIN_DEFAULT_LABELS: Record<string, Record<string, string>> = {
  customer_name:    { en: 'Full name',         he: 'שם מלא',       fr: 'Nom complet' },
  customer_phone:   { en: 'Phone number',      he: 'טלפון',        fr: 'Téléphone' },
  delivery_address: { en: 'Delivery address',  he: 'כתובת למשלוח', fr: 'Adresse de livraison' },
  delivery_city:    { en: 'City',              he: 'עיר',          fr: 'Ville' },
  delivery_floor:   { en: 'Floor',             he: 'קומה',          fr: 'Étage' },
  delivery_apt:     { en: 'Apartment / unit',  he: 'דירה',          fr: 'Appartement' },
  delivery_notes:   { en: 'Delivery notes',    he: 'הערות למשלוח', fr: 'Notes de livraison' },
  pickup_notes:     { en: 'Notes',             he: 'הערות',        fr: 'Notes' },
};

interface BuilderState {
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryFloor: string;
  deliveryApt: string;
  deliveryNotes: string;
  pickupNotes: string;
  customFields: Record<string, string | boolean>;
}

export interface CheckoutBuilderFieldsProps {
  form: CheckoutFormConfig;
  state: BuilderState;
  onBuiltinChange: (id: string, value: string) => void;
  onCustomChange: (id: string, value: string | boolean) => void;
  onAddressGeocoded?: (lat: number, lng: number, city: string) => void;
  googlePlacesApiKey?: string;
  countrySelect?: React.ReactNode;
}

/**
 * Renders the checkout details form from a builder-defined CheckoutFormConfig.
 *
 * Each field is shown in the order configured by the owner. Built-in fields
 * map to the typed state on the parent (customer_name, delivery_address, etc.);
 * custom fields go into state.customFields keyed by field id.
 *
 * When the address-autocomplete toggle is on and a Google Places API key is
 * provided, the delivery_address input is bound to a Places Autocomplete
 * widget. Selections trigger onAddressGeocoded with lat/lng/city to keep
 * payloads complete even if the city field is also displayed.
 */
export default function CheckoutBuilderFields({
  form, state, onBuiltinChange, onCustomChange, onAddressGeocoded,
  googlePlacesApiKey, countrySelect,
}: CheckoutBuilderFieldsProps) {
  const { locale, t } = useI18n();
  const addressInputRef = useRef<HTMLInputElement | null>(null);

  // Mirror current state into an id->value map for visibility evaluation.
  // Booleans for checkbox-typed custom fields; strings everywhere else.
  const valuesById = useMemo(() => {
    const m: Record<string, string | boolean> = {
      customer_name:    state.customerName,
      customer_phone:   state.customerPhone,
      delivery_address: state.deliveryAddress,
      delivery_city:    state.deliveryCity,
      delivery_floor:   state.deliveryFloor,
      delivery_apt:     state.deliveryApt,
      delivery_notes:   state.deliveryNotes,
      pickup_notes:     state.pickupNotes,
    };
    for (const [k, v] of Object.entries(state.customFields)) m[k] = v;
    return m;
  }, [state]);

  // Bind Google Places Autocomplete to the address input when enabled.
  useEffect(() => {
    if (!form.address_autocomplete || !googlePlacesApiKey) return;
    let cancelled = false;
    let autocomplete: any = null;
    loadGooglePlacesScript(googlePlacesApiKey).then(() => {
      if (cancelled || !addressInputRef.current) return;
      const g = (window as any).google;
      if (!g?.maps?.places) return;
      autocomplete = new g.maps.places.Autocomplete(addressInputRef.current, {
        types: ['address'],
        fields: ['geometry', 'address_components', 'formatted_address'],
      });
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place) return;
        const formatted: string = place.formatted_address || addressInputRef.current?.value || '';
        let city = '';
        for (const comp of place.address_components || []) {
          if (comp.types?.includes('locality')) city = comp.long_name;
          else if (!city && comp.types?.includes('administrative_area_level_2')) city = comp.long_name;
        }
        const lat = place.geometry?.location?.lat?.();
        const lng = place.geometry?.location?.lng?.();
        onBuiltinChange('delivery_address', formatted);
        if (city) onBuiltinChange('delivery_city', city);
        if (typeof lat === 'number' && typeof lng === 'number' && onAddressGeocoded) {
          onAddressGeocoded(lat, lng, city);
        }
      });
    }).catch(() => {
      // Network/blocked — fall back silently to plain text input.
    });
    return () => { cancelled = true; };
  }, [form.address_autocomplete, googlePlacesApiKey, onAddressGeocoded, onBuiltinChange]);

  return (
    <div className="space-y-4">
      {form.fields.map((field) => {
        if (!field.enabled) return null;
        if (!evaluateVisibility(field.visible_when ?? null, valuesById)) return null;
        return (
          <FieldRow
            key={field.id}
            field={field}
            locale={locale}
            value={(valuesById[field.id] as string | boolean) ?? (field.type === 'checkbox' ? false : '')}
            onChange={(v) => {
              if (BUILTIN_FIELD_IDS.has(field.id)) onBuiltinChange(field.id, String(v));
              else onCustomChange(field.id, v);
            }}
            addressInputRef={field.id === 'delivery_address' ? addressInputRef : undefined}
            countrySelect={field.id === 'customer_phone' ? countrySelect : undefined}
          />
        );
      })}
      {t === t ? null : null /* keep t in deps for future */}
    </div>
  );
}

function FieldRow({
  field, locale, value, onChange, addressInputRef, countrySelect,
}: {
  field: CheckoutFieldConfig;
  locale: string;
  value: string | boolean;
  onChange: (v: string | boolean) => void;
  addressInputRef?: React.MutableRefObject<HTMLInputElement | null>;
  countrySelect?: React.ReactNode;
}) {
  const label = (
    localisedText(field.label, locale)
    || localisedText(BUILTIN_DEFAULT_LABELS[field.id], locale)
    || field.id
  );
  const placeholder = localisedText(field.placeholder, locale);
  const type = field.type ?? (field.kind === 'builtin' ? builtinDefaultType(field.id) : 'text');

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
          className="w-full px-4 py-3 border border-[var(--divider)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-[var(--surface)] text-[var(--text)]"
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
          className="w-full px-4 py-3 border border-[var(--divider)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-[var(--surface)] text-[var(--text)] resize-none"
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
            className="flex-1 px-4 py-3 border border-[var(--divider)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-[var(--surface)] text-[var(--text)]"
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
        ref={addressInputRef}
        type={type === 'email' ? 'email' : type === 'tel' ? 'tel' : 'text'}
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
        placeholder={placeholder}
        className="w-full px-4 py-3 border border-[var(--divider)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-[var(--surface)] text-[var(--text)]"
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
  if (id === 'customer_phone') return 'tel';
  if (id === 'delivery_notes' || id === 'pickup_notes') return 'textarea';
  return 'text';
}
