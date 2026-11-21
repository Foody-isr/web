'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { DeliveryAddressConfirmation, manualLabels, type PostalDraft } from './DeliveryAddressConfirmation';
import { useI18n } from '@/lib/i18n';
import { ApiError, autocompleteDeliveryAddress, confirmDeliveryAddress, fetchDeliveryCities, resolveDeliveryAddress, type DeliveryAddressSuggestion } from '@/services/api';
import { addressFieldObservation } from '@/lib/address-field-observation';
import { useAddressAutocomplete } from '@/hooks/useAddressAutocomplete';
import { observeDeliveryAddressField } from '@/services/api';
import { enteredPostalAddress, postalForSelectedStreet, samePostalBuilding } from '@/lib/delivery-address-input';

type AddressOption = DeliveryAddressSuggestion & { entered?: true };

const enteredLabels = {
  fr: { option: 'Utiliser l’adresse saisie', hint: 'Choisissez votre adresse pour vérifier la livraison.', retry: 'La vérification a échoué. Choisissez à nouveau l’adresse pour réessayer.', city: 'Ajoutez la ville après une virgule, par exemple « rue et numéro, ville ».' },
  he: { option: 'שימוש בכתובת שהוקלדה', hint: 'בחרו בכתובת כדי לבדוק אפשרות משלוח.', retry: 'בדיקת הכתובת נכשלה. בחרו בה שוב כדי לנסות מחדש.', city: 'הוסיפו את העיר אחרי פסיק, למשל ״רחוב ומספר, עיר״.' },
  en: { option: 'Use the address you entered', hint: 'Choose your address to check delivery.', retry: 'The address check failed. Choose the address again to retry.', city: 'Add the city after a comma, for example “street and number, city”.' },
};

const copy = {
  en: { hint: 'Enter the street, house number and city, then choose a suggestion.', number: 'Add the house number', complete: 'Add the street and house number', loading: 'Searching addresses…', empty: 'No address found. Try adding the city or checking the spelling.', failed: 'Google address search is unavailable.', selected: 'Address selected' },
  fr: { hint: 'Saisissez la rue, le numéro et la ville, puis choisissez une suggestion.', number: 'Ajoutez le numéro de rue', complete: 'Ajoutez la rue et le numéro', loading: 'Recherche d’adresses…', empty: 'Aucune adresse trouvée. Ajoutez la ville ou vérifiez l’orthographe.', failed: 'La recherche Google est indisponible.', selected: 'Adresse sélectionnée' },
  he: { hint: 'הקלידו רחוב, מספר בית ועיר ובחרו כתובת מהרשימה.', number: 'הוסיפו מספר בית', complete: 'הוסיפו רחוב ומספר בית', loading: 'חיפוש כתובות…', empty: 'לא נמצאה כתובת. נסו להוסיף עיר או לבדוק את האיות.', failed: 'חיפוש הכתובות של Google אינו זמין.', selected: 'הכתובת נבחרה' },
};

type Props = {
  restaurantId: string;
  enabled: boolean;
  value: string;
  selectionToken?: string;
  selectionCity?: string;
  /** Keep suggestions inside a scrolling dialog's layout so none are clipped. */
  inlineSuggestions?: boolean;
  /** Dismiss the mobile keyboard once a complete address has been selected. */
  blurOnSelect?: boolean;
  onChange: (value: string) => void;
  onSelect: (suggestion: DeliveryAddressSuggestion) => void;
  placeholder?: string;
  label: string;
  inputId?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

/** Accessible address combobox; editing invalidates the parent's signed selection. */
export function DeliveryAddressAutocomplete({ restaurantId, enabled, value, selectionToken, selectionCity, inlineSuggestions, blurOnSelect, onChange, onSelect, placeholder, label, inputId, required, disabled, className }: Props) {
  const { locale, direction, t } = useI18n();
  const { data: policy } = useAddressAutocomplete(enabled ? restaurantId : undefined);
  const until = policy?.observation_until;
  const observer = useMemo(() => addressFieldObservation(until, event => {
    void observeDeliveryAddressField(restaurantId, event).catch(() => { /* Offline measurement must not interrupt entry. */ });
  }), [restaurantId, until]);
  const words = copy[locale as keyof typeof copy] ?? copy.he;
  const enteredWords = enteredLabels[locale as keyof typeof enteredLabels] ?? enteredLabels.he;
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [suggestions, setSuggestions] = useState<AddressOption[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error' | 'retry'>('idle');
  const [resolving, setResolving] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [searchRevision, setSearchRevision] = useState(0);
  const [manual, setManual] = useState<PostalDraft | null>(null);
  const selectedDraft = useRef<PostalDraft | null>(null);
  const generation = useRef(0);
  const session = useRef('');
  const resolvingRef = useRef(false);
  const resolveController = useRef<AbortController | undefined>(undefined);

  useEffect(() => () => { generation.current++; resolveController.current?.abort(); }, []);
  useEffect(() => {
    session.current = ''; selectedDraft.current = null; setManual(null);
    return () => { generation.current++; resolveController.current?.abort(); };
  }, [restaurantId, enabled]);

  const retrySearch = () => { setOpen(true); setSearchRevision(revision => revision + 1); };
  useEffect(() => {
    if (status !== 'error' && status !== 'retry') return;
    window.addEventListener('online', retrySearch);
    return () => window.removeEventListener('online', retrySearch);
  }, [status]);

  useEffect(() => {
    input.current?.setCustomValidity(enabled && required && value.trim() && !selectionToken ? t('selectVerifiedAddress') : '');
  }, [enabled, required, value, selectionToken, manual, t]);

  useEffect(() => {
    const request = ++generation.current;
    setSuggestions([]);
    setActive(-1);
    setStatus('idle');
    if (!enabled || disabled || manual || selectionToken || value.trim().length < 3) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function search(mayRetry: boolean) {
      setStatus('loading');
      let results: AddressOption[] = [];
      let failed = false;
      try {
        if (!session.current) session.current = crypto.randomUUID();
        results = await autocompleteDeliveryAddress(restaurantId, value.trim(), locale, session.current, controller.signal);
      } catch (error) {
        if (controller.signal.aborted || generation.current !== request) return;
        session.current = '';
        if (mayRetry && (error instanceof TypeError || !(error instanceof ApiError) || error.status === 409 || (error.status ?? 0) >= 500)) {
          timer = setTimeout(() => void search(false), 450);
          return;
        }
        failed = true;
      }
      if (controller.signal.aborted || generation.current !== request) return;
      if (/\d/u.test(value)) {
        let draft = enteredPostalAddress(value);
        if (!draft) draft = enteredPostalAddress(value, results.map(row => row.city.split(',')[0]));
        if (!draft && !value.includes(',')) {
          const cities = await fetchDeliveryCities(restaurantId, controller.signal).catch(() => []);
          if (controller.signal.aborted || generation.current !== request) return;
          draft = enteredPostalAddress(value, cities);
        }
        const entered = draft;
        const coversBuilding = entered && results.some(row => {
          if (samePostalBuilding(row, entered)) return true;
          const city = row.city.split(',')[0];
          const postal = postalForSelectedStreet(value, { address: row.address, city }, row.street || row.address, city, row.house_number);
          return !!postal && samePostalBuilding(postal, entered);
        });
        if (entered && !coversBuilding) {
          results = [{ ...entered, entered: true, id: 'guest-postal', street: '', house_number: '', token: '' }, ...results];
        }
      }
      observer.available(results.length > 0);
      setSuggestions(results);
      setStatus(failed ? 'error' : 'ready');
    }
    timer = setTimeout(() => void search(true), 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [value, locale, restaurantId, enabled, selectionToken, disabled, manual, searchRevision, observer]);

  const choose = async (prediction: AddressOption) => {
    if (resolvingRef.current) return;
    observer.choose();
    const request = ++generation.current;
    setOpen(false);
    let suggestion: DeliveryAddressSuggestion = prediction;
    const predicted = { address: prediction.address, city: prediction.city?.split(',')[0]?.trim() ?? '' };
    selectedDraft.current = predicted;
    resolvingRef.current = true;
    setResolving(true);
    setStatus('loading');
    const controller = new AbortController();
    resolveController.current = controller;
    try {
      let postal = prediction.entered ? predicted : undefined;
      if (prediction.lookup_token) {
        try {
          suggestion = await resolveDeliveryAddress(restaurantId, prediction.lookup_token, controller.signal);
        } catch (error) {
          // A numbered label the guest already chose can still be checked as postal text during an outage.
          if (controller.signal.aborted || generation.current !== request) return;
          if (!(error instanceof TypeError || (error instanceof ApiError && (error.status ?? 0) >= 500))) throw error;
          postal = enteredPostalAddress([predicted.address, predicted.city].join(', '));
          if (!postal) throw error;
        }
      }
      if (controller.signal.aborted || generation.current !== request) return;
      if (!postal && (suggestion.kind === 'street' || (prediction.lookup_token && suggestion.house_number))) {
        postal = postalForSelectedStreet(value, predicted, suggestion.street, suggestion.city, suggestion.house_number);
      }
      if (postal) suggestion = await confirmDeliveryAddress(restaurantId, postal, controller.signal);
      if (controller.signal.aborted || generation.current !== request) return;
      if (suggestion.token) {
        setSuggestions([]);
        onSelect({ ...suggestion, observation: observer.accept() });
        if (blurOnSelect) input.current?.blur();
        return;
      }
      const street = suggestion.kind === 'street';
      const refinement = street
        ? `${suggestion.street} ${suggestion.city ? `, ${suggestion.city}` : ''}`
        : [suggestion.address, suggestion.city !== suggestion.address ? suggestion.city : ''].filter(Boolean).join(', ');
      onChange(refinement);
      // A street leaves room for the number; other places keep the caret at the end.
      requestAnimationFrame(() => {
        setOpen(true);
        input.current?.focus();
        const caret = street ? suggestion.street.length + 1 : refinement.length;
        input.current?.setSelectionRange(caret, caret);
      });
    } catch (error) {
      if (!controller.signal.aborted && generation.current === request) {
        setOpen(true);
        observer.available(false);
        setStatus('retry');
        if (prediction.lookup_token && error instanceof ApiError && (error.status === 400 || error.status === 409)) {
          setSearchRevision(revision => revision + 1);
        }
      }
    } finally {
      if (resolveController.current === controller) {
        session.current = '';
        resolvingRef.current = false;
        setResolving(false);
      }
    }
  };
  const expanded = enabled && open && suggestions.length > 0;
  useEffect(() => {
    if (expanded && active >= 0) list.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active, expanded]);
  let message = words.hint;
  if (selectionToken) message = [words.selected, selectionCity].filter(Boolean).join(' · ');
  else if (status === 'loading') message = words.loading;
  else if (status === 'retry') message = enteredWords.retry;
  else if (suggestions[0]?.entered) message = enteredWords.hint;
  else if (status === 'error') message = [words.failed, enteredWords.city].join(' ');
  else if (status === 'ready' && !suggestions.length) message = words.empty;
  if (enabled && manual) return <div className="delivery-address-autocomplete relative" dir={direction}>
    <DeliveryAddressConfirmation key={restaurantId} restaurantId={restaurantId} draft={manual} disabled={disabled}
      onBack={draft => { selectedDraft.current = draft; setManual(null); onChange([draft.address, draft.city].filter(Boolean).join(', ')); setOpen(true); requestAnimationFrame(() => input.current?.focus()); }}
      onSelect={selection => { selectedDraft.current = null; setManual(null); setOpen(false); onSelect({ ...selection, observation: observer.accept(true) }); }} />
  </div>;
  const startManual = () => {
    generation.current++; resolveController.current?.abort(); setOpen(false);
    if (selectionToken) selectedDraft.current = { address: value, city: selectionCity ?? '' };
    const [address, city = ''] = value.split(',').map(part => part.trim());
    setManual(selectedDraft.current ?? { address, city: selectionCity || city });
    if (selectionToken) onChange(value);
  };
  return (
    <div className="delivery-address-autocomplete relative" dir={direction}>
      <input
        ref={input}
        dir="auto"
        id={inputId}
        aria-label={label}
        role={enabled ? 'combobox' : undefined}
        aria-autocomplete={enabled ? 'list' : undefined}
        aria-expanded={enabled ? expanded : undefined}
        aria-controls={expanded ? `${id}-options` : undefined}
        aria-activedescendant={expanded && active >= 0 ? `${id}-option-${active}` : undefined}
        aria-describedby={enabled ? `${id}-status` : undefined}
        autoComplete={enabled ? 'off' : 'street-address'}
        value={selectionToken && selectionCity ? `${value}, ${selectionCity}` : value}
        disabled={disabled}
        aria-busy={resolving || undefined}
        required={required}
        maxLength={200}
        placeholder={placeholder}
        className={className ?? 'w-full rounded-xl border border-[var(--divider)] bg-[var(--surface)] px-4 py-3 text-[var(--checkout-input,var(--text))] focus:outline-none focus:ring-2 focus:ring-brand'}
        onChange={event => { generation.current++; resolveController.current?.abort(); selectedDraft.current = null; setOpen(true); onChange(event.target.value); }}
        onFocus={() => setOpen(true)}
        // Inline results belong to the dialog: dismissing the OS keyboard must
        // leave them available to touch. Floating dropdowns still close on blur.
        onBlur={() => { if (!inlineSuggestions) setOpen(false); }}
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
      {expanded && <ul ref={list} id={`${id}-options`} role="listbox" aria-label={label} className={`${inlineSuggestions ? 'relative' : 'absolute inset-x-0'} z-50 mt-1 max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-1 text-[var(--text)] shadow-xl`}>
        {suggestions.map((suggestion, index) => <li
          key={`${suggestion.id}-${index}`} id={`${id}-option-${index}`} role="option" aria-selected={active === index}
          className={`cursor-pointer rounded-lg px-3 py-3 text-sm ${active === index ? 'bg-black/10' : 'hover:bg-black/5'}`}
          onPointerDown={event => event.preventDefault()}
          onPointerMove={() => setActive(index)}
          onClick={() => choose(suggestion)}
        ><span className="delivery-address-option-primary block font-medium">{suggestion.address}</span><span className="delivery-address-option-secondary block opacity-75">{suggestion.city}{suggestion.postcode ? ` · ${suggestion.postcode}` : ''}{suggestion.entered && <> · {enteredWords.option}</>}{inlineSuggestions && !suggestion.entered && !suggestion.token && suggestion.kind !== 'prediction' && <> · {suggestion.kind === 'street' ? words.number : words.complete}</>}</span>{!inlineSuggestions && !suggestion.entered && !suggestion.token && suggestion.kind !== 'prediction' && <span className="block text-xs opacity-75">{suggestion.kind === 'street' ? words.number : words.complete}</span>}</li>)}
      </ul>}
      {enabled && <div className="delivery-address-attribution mt-1 space-y-1 text-xs text-[var(--text-muted)]">
        <p id={`${id}-status`} role="status" aria-live="polite" data-hint={!selectionToken && (status === 'idle' || (status === 'ready' && suggestions.length > 0))}>{message}</p>
        {(status === 'error' || status === 'retry' || (status === 'ready' && !suggestions.length)) &&
          <button type="button" onClick={retrySearch} className="min-h-11 underline">{t('tryAgain')}</button>}
        <p><a className="underline whitespace-nowrap text-xs font-normal not-italic" translate="no" href="https://maps.google.com/" target="_blank" rel="noreferrer">Google Maps</a></p>
      </div>}
      {enabled && <button type="button" className="min-h-11 shrink-0 self-start text-start text-sm underline" disabled={disabled} onClick={startManual}>
        {(manualLabels[locale as keyof typeof manualLabels] ?? manualLabels.he).open}
      </button>}
    </div>
  );
}
