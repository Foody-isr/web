'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { autocompleteDeliveryAddress, resolveDeliveryAddress, type DeliveryAddressSuggestion } from '@/services/api';

const copy = {
  en: { hint: 'Enter the street, house number and city, then choose a suggestion.', number: 'Add the house number', complete: 'Add the street and house number', loading: 'Searching addresses…', empty: 'No address found. Try adding the city or checking the spelling.', failed: 'Address search is unavailable. Please try again.', selected: 'Address selected' },
  fr: { hint: 'Saisissez la rue, le numéro et la ville, puis choisissez une suggestion.', number: 'Ajoutez le numéro de rue', complete: 'Ajoutez la rue et le numéro', loading: 'Recherche d’adresses…', empty: 'Aucune adresse trouvée. Ajoutez la ville ou vérifiez l’orthographe.', failed: 'La recherche d’adresses est indisponible. Réessayez.', selected: 'Adresse sélectionnée' },
  he: { hint: 'הקלידו רחוב, מספר בית ועיר ובחרו כתובת מהרשימה.', number: 'הוסיפו מספר בית', complete: 'הוסיפו רחוב ומספר בית', loading: 'חיפוש כתובות…', empty: 'לא נמצאה כתובת. נסו להוסיף עיר או לבדוק את האיות.', failed: 'חיפוש הכתובות אינו זמין. נסו שוב.', selected: 'הכתובת נבחרה' },
};

const errors = {
  en: { quota: 'The address service is temporarily unavailable. Contact the restaurant and share this message: ADR-QUOTA.', rate: 'Too many address searches. Wait a minute before trying again.' },
  fr: { quota: 'Le service d’adresses est momentanément indisponible. Contactez le restaurant et transmettez-lui ce message : ADR-QUOTA.', rate: 'Trop de recherches d’adresses. Attendez une minute avant de réessayer.' },
  he: { quota: 'שירות הכתובות אינו זמין כרגע. פנו למסעדה והעבירו לה את ההודעה: ADR-QUOTA.', rate: 'בוצעו יותר מדי חיפושי כתובת. המתינו דקה ונסו שוב.' },
};

type Props = {
  restaurantId: string;
  enabled: boolean;
  value: string;
  selectionToken?: string;
  selectionCity?: string;
  /** Keep suggestions inside a scrolling dialog's layout so none are clipped. */
  inlineSuggestions?: boolean;
  onChange: (value: string) => void;
  onSelect: (suggestion: DeliveryAddressSuggestion) => void;
  placeholder?: string;
  label: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

/** Accessible address combobox; editing invalidates the parent's signed selection. */
export function DeliveryAddressAutocomplete({ restaurantId, enabled, value, selectionToken, selectionCity, inlineSuggestions, onChange, onSelect, placeholder, label, required, disabled, className }: Props) {
  const { locale, direction, t } = useI18n();
  const words = copy[locale as keyof typeof copy] ?? copy.he;
  const errorWords = errors[locale as keyof typeof errors] ?? errors.he;
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<DeliveryAddressSuggestion[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error' | 'quota' | 'rate'>('idle');
  const [resolving, setResolving] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const generation = useRef(0);
  const session = useRef('');
  const quotaReached = useRef(false);
  const resolvingRef = useRef(false);
  const resolveController = useRef<AbortController | undefined>(undefined);

  useEffect(() => () => { generation.current++; resolveController.current?.abort(); }, []);
  useEffect(() => { session.current = ''; }, [restaurantId]);

  const reportError = (error: unknown) => {
    const code = error instanceof Error ? error.message : '';
    if (code === 'address_quota_exhausted') { quotaReached.current = true; setStatus('quota'); }
    else if (code === 'address_rate_limited') { session.current = ''; setStatus('rate'); }
    else { if (code === 'address_session_expired') session.current = ''; setStatus('error'); }
  };

  useEffect(() => {
    input.current?.setCustomValidity(enabled && required && value.trim() && !selectionToken ? t('selectVerifiedAddress') : '');
  }, [enabled, required, value, selectionToken, t]);

  useEffect(() => {
    const request = ++generation.current;
    setSuggestions([]);
    setActive(-1);
    if (quotaReached.current) { setStatus('quota'); return; }
    setStatus('idle');
    if (!enabled || disabled || selectionToken || value.trim().length < 3) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus('loading');
      try {
        if (!session.current) session.current = crypto.randomUUID();
        const results = await autocompleteDeliveryAddress(restaurantId, value.trim(), locale, session.current, controller.signal);
        if (controller.signal.aborted || generation.current !== request) return;
        setSuggestions(results);
        setStatus('ready');
      } catch (error) {
        if (!controller.signal.aborted && generation.current === request) reportError(error);
      }
    }, 500);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [value, locale, restaurantId, enabled, selectionToken, disabled]);

  const choose = async (prediction: DeliveryAddressSuggestion) => {
    if (resolvingRef.current || quotaReached.current) return;
    const request = ++generation.current;
    setOpen(false);
    setSuggestions([]);
    let suggestion = prediction;
    if (prediction.lookup_token) {
      resolvingRef.current = true;
      setResolving(true);
      setStatus('loading');
      const controller = new AbortController();
      resolveController.current = controller;
      try {
        suggestion = await resolveDeliveryAddress(restaurantId, prediction.lookup_token, controller.signal);
        if (controller.signal.aborted || generation.current !== request) return;
      } catch (error) {
        if (!controller.signal.aborted && generation.current === request) reportError(error);
        return;
      } finally {
        session.current = '';
        resolvingRef.current = false;
        setResolving(false);
      }
    }
    if (!suggestion.token) {
      const street = suggestion.kind === 'street';
      const refinement = street
        ? `${suggestion.street} ${suggestion.city ? `, ${suggestion.city}` : ''}`
        : [suggestion.address, suggestion.city !== suggestion.address ? suggestion.city : ''].filter(Boolean).join(', ');
      onChange(refinement);
      // A street leaves room for the number; other places keep the caret at the end.
      requestAnimationFrame(() => {
        input.current?.focus();
        const caret = street ? suggestion.street.length + 1 : refinement.length;
        input.current?.setSelectionRange(caret, caret);
      });
      return;
    }
    onSelect(suggestion);
  };
  const expanded = enabled && open && suggestions.length > 0;
  const message = selectionToken ? `${words.selected}${selectionCity ? ` · ${selectionCity}` : ''}` : status === 'quota' ? errorWords.quota : status === 'rate' ? errorWords.rate : status === 'loading' ? words.loading : status === 'error' ? words.failed : status === 'ready' && !suggestions.length ? words.empty : words.hint;
  return (
    <div className="relative" dir={direction}>
      <input
        ref={input}
        aria-label={label}
        role={enabled ? 'combobox' : undefined}
        aria-autocomplete={enabled ? 'list' : undefined}
        aria-expanded={enabled ? expanded : undefined}
        aria-controls={expanded ? `${id}-options` : undefined}
        aria-activedescendant={expanded && active >= 0 ? `${id}-option-${active}` : undefined}
        aria-describedby={enabled ? `${id}-status` : undefined}
        autoComplete={enabled ? 'off' : 'street-address'}
        value={selectionToken && selectionCity ? `${value}, ${selectionCity}` : value}
        disabled={disabled || resolving}
        required={required}
        maxLength={200}
        placeholder={placeholder}
        className={className ?? 'w-full rounded-xl border border-[var(--divider)] bg-[var(--surface)] px-4 py-3 text-[var(--checkout-input,var(--text))] focus:outline-none focus:ring-2 focus:ring-brand'}
        onChange={event => { setOpen(true); onChange(event.target.value); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={event => {
          if (!enabled) return;
          if (event.key === 'Escape') { setOpen(false); return; }
          if (suggestions.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault(); setOpen(true);
            setActive(index => index < 0 ? (event.key === 'ArrowDown' ? 0 : suggestions.length - 1) : (index + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length);
          }
          if (expanded && event.key === 'Enter' && active >= 0) { event.preventDefault(); choose(suggestions[active]); }
        }}
      />
      {expanded && <ul id={`${id}-options`} role="listbox" aria-label={label} className={`${inlineSuggestions ? 'relative' : 'absolute inset-x-0'} z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-1 text-[var(--text)] shadow-xl`}>
        {suggestions.map((suggestion, index) => <li
          key={`${suggestion.id}-${index}`} id={`${id}-option-${index}`} role="option" aria-selected={active === index}
          className={`cursor-pointer rounded-lg px-3 py-3 text-sm ${active === index ? 'bg-black/10' : 'hover:bg-black/5'}`}
          onPointerDown={event => event.preventDefault()}
          onMouseEnter={() => setActive(index)}
          onClick={() => choose(suggestion)}
        ><span className="block font-medium">{suggestion.address}</span><span className="block opacity-75">{suggestion.city}{suggestion.postcode ? ` · ${suggestion.postcode}` : ''}</span>{!suggestion.token && suggestion.kind !== 'prediction' && <span className="block text-xs opacity-75">{suggestion.kind === 'street' ? words.number : words.complete}</span>}</li>)}
      </ul>}
      {enabled && <div className="mt-1 space-y-1 text-xs text-[var(--text-muted)]">
        <p id={`${id}-status`} role="status" aria-live="polite">{message}</p>
        <p><a className="underline whitespace-nowrap text-xs font-normal not-italic" translate="no" href="https://maps.google.com/" target="_blank" rel="noreferrer">Google Maps</a></p>
      </div>}
    </div>
  );
}
