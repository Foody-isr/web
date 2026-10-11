'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { autocompleteDeliveryAddress, type DeliveryAddressSuggestion } from '@/services/api';

const copy = {
  en: { hint: 'Enter the street, house number and city, then choose a suggestion.', loading: 'Searching addresses…', empty: 'No precise address found. Check the street, number and city.', failed: 'Address search is unavailable. Please try again.', selected: 'Address selected', attribution: 'Powered by' },
  fr: { hint: 'Saisissez la rue, le numéro et la ville, puis choisissez une suggestion.', loading: 'Recherche d’adresses…', empty: 'Aucune adresse précise trouvée. Vérifiez la rue, le numéro et la ville.', failed: 'La recherche d’adresses est indisponible. Réessayez.', selected: 'Adresse sélectionnée', attribution: 'Fourni par' },
  he: { hint: 'הקלידו רחוב, מספר בית ועיר ובחרו כתובת מהרשימה.', loading: 'חיפוש כתובות…', empty: 'לא נמצאה כתובת מדויקת. בדקו את הרחוב, מספר הבית והעיר.', failed: 'חיפוש הכתובות אינו זמין. נסו שוב.', selected: 'הכתובת נבחרה', attribution: 'מופעל על ידי' },
};

type Props = {
  restaurantId: string;
  enabled: boolean;
  value: string;
  selectionToken?: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: DeliveryAddressSuggestion) => void;
  placeholder?: string;
  label: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

/** Accessible address combobox; editing invalidates the parent's signed selection. */
export function DeliveryAddressAutocomplete({ restaurantId, enabled, value, selectionToken, onChange, onSelect, placeholder, label, required, disabled, className }: Props) {
  const { locale, direction, t } = useI18n();
  const words = copy[locale as keyof typeof copy] ?? copy.he;
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<DeliveryAddressSuggestion[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const generation = useRef(0);

  useEffect(() => {
    input.current?.setCustomValidity(enabled && required && value.trim() && !selectionToken ? t('selectVerifiedAddress') : '');
  }, [enabled, required, value, selectionToken, t]);

  useEffect(() => {
    const request = ++generation.current;
    setSuggestions([]);
    setActive(-1);
    setStatus('idle');
    if (!enabled || disabled || selectionToken || value.trim().length < 3) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus('loading');
      try {
        const results = await autocompleteDeliveryAddress(restaurantId, value.trim(), locale, controller.signal);
        if (controller.signal.aborted || generation.current !== request) return;
        setSuggestions(results);
        setStatus('ready');
      } catch {
        if (!controller.signal.aborted && generation.current === request) setStatus('error');
      }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [value, locale, restaurantId, enabled, selectionToken, disabled]);

  const choose = (suggestion: DeliveryAddressSuggestion) => {
    generation.current++;
    setOpen(false);
    setSuggestions([]);
    onSelect(suggestion);
  };
  const expanded = enabled && open && suggestions.length > 0;
  const message = selectionToken ? words.selected : status === 'loading' ? words.loading : status === 'error' ? words.failed : status === 'ready' && !suggestions.length ? words.empty : words.hint;
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
        value={value}
        disabled={disabled}
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
      {expanded && <ul id={`${id}-options`} role="listbox" aria-label={label} className="absolute inset-x-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-1 text-[var(--text)] shadow-xl">
        {suggestions.map((suggestion, index) => <li
          key={`${suggestion.id}-${index}`} id={`${id}-option-${index}`} role="option" aria-selected={active === index}
          className={`cursor-pointer rounded-lg px-3 py-3 text-sm ${active === index ? 'bg-black/10' : 'hover:bg-black/5'}`}
          onPointerDown={event => event.preventDefault()}
          onMouseEnter={() => setActive(index)}
          onClick={() => choose(suggestion)}
        ><span className="block font-medium">{suggestion.address}</span><span className="block opacity-75">{suggestion.city}{suggestion.postcode ? ` · ${suggestion.postcode}` : ''}</span></li>)}
      </ul>}
      {enabled && <div className="mt-1 space-y-1 text-xs text-[var(--text-muted)]">
        <p id={`${id}-status`} role="status" aria-live="polite">{message}</p>
        <p>{words.attribution} <a className="underline" href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Geoapify</a> · © <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a></p>
      </div>}
    </div>
  );
}
