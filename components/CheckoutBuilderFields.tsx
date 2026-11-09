'use client';

import { useId } from 'react';
import { DeliveryAddressAutocomplete } from '@/components/DeliveryAddressAutocomplete';
import type { DeliveryAddressSuggestion } from '@/services/api';
import { useI18n } from '@/lib/i18n';
import {
  BUILTIN_FIELD_IDS,
  evaluateVisibility,
  localisedText,
  checkoutFieldLabel,
} from '@/lib/checkout-fields';
import type { CheckoutFieldConfig, CheckoutFormConfig } from '@/lib/types';

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
  /** Keeps order-specific consent visible while contact details are summarized. */
  collapsed?: boolean;
  onAddressSelected: (suggestion: DeliveryAddressSuggestion) => void;
  countrySelect?: React.ReactNode;
  phoneInvalid?: boolean;
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
  restaurantId, autocompleteEnabled, addressSelectionToken, addressInSummary, collapsed = false, countrySelect, cityOptions, renderAfterField, phoneInvalid,
}: CheckoutBuilderFieldsProps) {
  const { locale } = useI18n();

  const valuesById: Record<string, string | boolean> = {
    ...state.customFields,
    customer_first_name: state.customerFirstName,
    customer_name: state.customerName,
    customer_phone: state.customerPhone,
    delivery_address: state.deliveryAddress,
    delivery_city: state.deliveryCity,
    delivery_floor: state.deliveryFloor,
    delivery_apt: state.deliveryApt,
    delivery_entry_code: state.deliveryEntryCode,
    delivery_notes: state.deliveryNotes,
    pickup_notes: state.pickupNotes,
  };

  const addressId = useId();
  const shownFields = form.fields.filter(field => field.enabled &&
    evaluateVisibility(field.visible_when, valuesById) &&
    !(addressInSummary && addressSelectionToken && (field.id === 'delivery_address' || field.id === 'delivery_city')));

  return (
    <div className={collapsed ? "grid gap-3" : "grid grid-cols-2 gap-x-3 gap-y-4"}>
      {shownFields.map((field, index) => {
        const after = renderAfterField?.(field.id);
        return (
          <div key={field.id} hidden={collapsed && field.type !== 'checkbox'} className={contactFieldSpan(shownFields, index)}>
            {field.id === 'delivery_address' ? <div>
              <CheckoutFieldLabel text={checkoutFieldLabel(field, locale)} required={field.required} htmlFor={addressId} />
              <DeliveryAddressAutocomplete inputId={addressId} restaurantId={restaurantId} enabled={autocompleteEnabled} value={state.deliveryAddress}
                label={checkoutFieldLabel(field, locale)} placeholder={localisedText(field.placeholder, locale)} required={field.required}
                className={checkoutControlClass} selectionToken={addressSelectionToken} selectionCity={state.deliveryCity} onChange={v => onBuiltinChange('delivery_address', v)} onSelect={onAddressSelected} />
            </div> : <FieldRow
              field={field}
              locale={locale}
              value={(valuesById[field.id] as string | boolean) ?? (field.type === 'checkbox' ? false : '')}
              onChange={(v) => {
                if (BUILTIN_FIELD_IDS.has(field.id)) onBuiltinChange(field.id, String(v));
                else onCustomChange(field.id, v);
              }}
              countrySelect={field.id === 'customer_phone' ? countrySelect : undefined}
              invalid={field.id === 'customer_phone' && phoneInvalid}
              cityOptions={field.id === 'delivery_city' && !autocompleteEnabled ? cityOptions : undefined}
            />}
            {after && <div className="mt-2">{after}</div>}
          </div>
        );
      })}
    </div>
  );
}

function FieldRow({
  field, locale, value, onChange, countrySelect, cityOptions, invalid,
}: {
  invalid?: boolean;
  field: CheckoutFieldConfig;
  locale: string;
  value: string | boolean;
  onChange: (v: string | boolean) => void;
  countrySelect?: React.ReactNode;
  cityOptions?: string[];
}) {
  const { t } = useI18n();
  const inputId = useId();
  const label = checkoutFieldLabel(field, locale);
  const placeholder = localisedText(field.placeholder, locale);
  const type = field.type ?? (field.kind === 'builtin' ? builtinDefaultType(field.id) : 'text');

  // When city options are provided for delivery_city, render a dropdown
  if (field.id === 'delivery_city' && cityOptions && cityOptions.length > 0) {
    return (
      <div>
        <CheckoutFieldLabel text={label} required={field.required} htmlFor={inputId} />
        <select id={inputId}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className={checkoutControlClass}
        >
          <option value="" disabled={field.required}>{t('chooseCity') || 'Choisir une ville'}</option>
          {cityOptions.map((city) => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>
      </div>
    );
  }

  if (type === 'checkbox') {
    return (
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--divider)] p-3">
        <input id={inputId}
          type="checkbox"
          checked={!!value}
          required={field.required}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 w-4 h-4"
        />
        <span className="text-sm text-[var(--text)]">
          {label}
          <FieldRequirement required={field.required} />
        </span>
      </label>
    );
  }

  if (type === 'select') {
    return (
      <div>
        <CheckoutFieldLabel text={label} required={field.required} htmlFor={inputId} />
        <select id={inputId}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className={checkoutControlClass}
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
        <CheckoutFieldLabel text={label} required={field.required} htmlFor={inputId} />
        <textarea id={inputId}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          rows={2}
          placeholder={placeholder}
          className={`${checkoutControlClass} resize-y`}
        />
      </div>
    );
  }

  // phone gets the country-code select inline if the parent provided one
  if (type === 'tel' && countrySelect) {
    return (
      <div>
        <CheckoutFieldLabel text={label} required={field.required} htmlFor={inputId} />
        <div className="flex gap-2" dir="ltr">
          {countrySelect}
          <input id={inputId}
            type="tel"
            aria-label={label}
            aria-invalid={invalid}
            aria-describedby={invalid ? 'checkout-phone-error' : undefined}
            autoComplete="tel-national"
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            placeholder={placeholder || '50-234-5678'}
            className={`${checkoutControlClass} flex-1`}
          />
        </div>
      </div>
    );
  }

  // text / tel without countrySelect / email
  return (
    <div>
      <CheckoutFieldLabel text={label} required={field.required} htmlFor={inputId} />
      <input id={inputId}
        type={type === 'email' ? 'email' : type === 'tel' ? 'tel' : 'text'}
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
        autoComplete={field.id === 'customer_first_name' ? 'given-name' : field.id === 'delivery_city' ? 'address-level2' : undefined}
        placeholder={placeholder}
        className={checkoutControlClass}
      />
    </div>
  );
}

/** Shared visual treatment for checkout contact inputs, independent of button shape. */
export const checkoutControlClass = "commerce-contact-control";

function FieldRequirement({ required }: { required: boolean }) {
  const { t } = useI18n();
  return <span className="ms-1.5 font-normal text-[var(--text-muted)]" aria-hidden="true">
    {required ? '*' : `(${t('optional')})`}
  </span>;
}

/** Contact labels show optionality next to the field it describes. */
export function CheckoutFieldLabel({ text, required = false, htmlFor }: { text: string; required?: boolean; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-[var(--text)]">
      {text}<FieldRequirement required={required} />
    </label>
  );
}

const fieldPairs = [
  ['customer_first_name', 'customer_name'],
  ['delivery_floor', 'delivery_apt', 'delivery_entry_code'],
];

function contactFieldSpan(fields: CheckoutFieldConfig[], index: number): string {
  const group = fieldPairs.find(ids => ids.includes(fields[index].id));
  if (!group) return 'col-span-2';
  // Pair only adjacent fields so the editor's order is preserved, including custom fields.
  let start = index;
  while (start > 0 && group.includes(fields[start - 1].id)) start--;
  const partner = (index - start) % 2 === 0 ? index + 1 : index - 1;
  return group.includes(fields[partner]?.id) ? 'col-span-2 min-[420px]:col-span-1' : 'col-span-2';
}

function builtinDefaultType(id: string): 'text' | 'tel' | 'textarea' {
  if (id === 'customer_phone' || id === 'whatsapp_number') return 'tel';
  if (id === 'delivery_notes' || id === 'pickup_notes') return 'textarea';
  return 'text';
}
