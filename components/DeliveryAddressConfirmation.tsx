'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { confirmDeliveryAddress, type DeliveryAddressSuggestion } from '@/services/api';
import type { EntrancePoint } from './DeliveryEntranceMap';

const DeliveryEntranceMap = dynamic(() => import('./DeliveryEntranceMap'), { ssr: false });

export const manualLabels = {
  fr: { open: 'Saisir l’adresse manuellement', street: 'Rue et numéro', city: 'Ville', confirm: 'Confirmer cette adresse', back: 'Retour à la recherche', map: 'Indiquer l’entrée sur la carte', remove: 'Continuer avec l’adresse seule', pin: 'Vérifiez l’entrée et la ville, ou continuez avec l’adresse seule.', invalid: 'Renseignez la rue, le numéro du bâtiment et la ville.', failed: 'La confirmation a échoué. Votre saisie est conservée. Réessayez.', checking: 'Vérification de l’adresse…' },
  en: { open: 'Enter address manually', street: 'Street and house number', city: 'City', confirm: 'Confirm this address', back: 'Back to search', map: 'Mark the entrance on the map', remove: 'Continue with the address only', pin: 'Check the entrance and city, or continue with the address only.', invalid: 'Enter the street, house number and city.', failed: 'Confirmation failed. Your address is still here. Please try again.', checking: 'Checking the address…' },
  he: { open: 'הזנה ידנית של כתובת', street: 'רחוב ומספר בית', city: 'עיר', confirm: 'אישור הכתובת', back: 'חזרה לחיפוש', map: 'סימון הכניסה במפה', remove: 'המשך עם הכתובת בלבד', pin: 'בדקו את הכניסה ואת העיר, או המשיכו עם הכתובת בלבד.', invalid: 'יש להזין רחוב, מספר בית ועיר.', failed: 'אישור הכתובת נכשל. הפרטים שהקלדתם נשמרו. נסו שוב.', checking: 'בודקים את הכתובת…' },
};

export type PostalDraft = { address: string; city: string };

/** Offers explicit manual entry and an optional entrance when the guest opens it. */
export function DeliveryAddressConfirmation({ restaurantId, draft, disabled, onBack, onSelect }: {
  restaurantId: string; draft: PostalDraft; disabled?: boolean;
  onBack: (draft: PostalDraft) => void; onSelect: (selection: DeliveryAddressSuggestion) => void;
}) {
  const { locale } = useI18n();
  const words = manualLabels[locale as keyof typeof manualLabels] ?? manualLabels.he;
  const [address, setAddress] = useState(draft.address);
  const [city, setCity] = useState(draft.city);
  const [mapOpen, setMapOpen] = useState(false);
  const [point, setPoint] = useState<EntrancePoint | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const streetInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    streetInput.current?.focus();
    return () => request.current?.abort();
  }, []);
  function edit(update: (text: string) => void, text: string) {
    update(text); setError(''); setPoint(null); setMapOpen(false);
  }
  async function confirm() {
    if (request.current || disabled || (mapOpen && !point)) return;
    if (!/\p{L}/u.test(address) || !/\d/.test(address) || !/\p{L}/u.test(city)) { setError(words.invalid); return; }
    const controller = new AbortController();
    request.current = controller;
    setPending(true); setError('');
    try {
      const selection = await confirmDeliveryAddress(restaurantId, { address: address.trim(), city: city.trim(), ...point }, controller.signal);
      if (!controller.signal.aborted) onSelect(selection);
    } catch (cause) {
      if (!controller.signal.aborted) {
        const code = cause instanceof Error ? cause.message : '';
        setError(code === 'address_entrance_mismatch' ? words.pin : code === 'invalid_address_selection' ? words.invalid : words.failed);
      }
    } finally {
      if (!controller.signal.aborted) { request.current = null; setPending(false); }
    }
  }
  const field = 'w-full rounded-xl border border-[var(--divider)] bg-[var(--surface)] px-3 py-2 text-base';
  return <fieldset disabled={disabled || pending} aria-busy={pending} className="min-w-0 space-y-2 border-0 p-0"
    onKeyDown={event => { if (event.key === 'Enter' && event.target instanceof HTMLInputElement) { event.preventDefault(); void confirm(); } }}>
    <label className="block text-sm">{words.street}<input ref={streetInput} dir="auto" autoComplete="street-address" maxLength={200} className={field} value={address} onChange={e => edit(setAddress, e.target.value)} /></label>
    <label className="block text-sm">{words.city}<input dir="auto" autoComplete="address-level2" maxLength={100} className={field} value={city} onChange={e => edit(setCity, e.target.value)} /></label>
    {mapOpen && <DeliveryEntranceMap restaurantId={restaurantId} city={city} point={point} onPick={value => { setPoint(value); setError(''); }} />}
    <button type="button" className="min-h-11 text-start text-sm underline" disabled={!city.trim()} onClick={() => { setMapOpen(!mapOpen); setPoint(null); setError(''); }}>{mapOpen ? words.remove : words.map}</button>
    {error && <p role="alert" className="text-sm">{error}</p>}
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <button type="button" disabled={mapOpen && !point} className="min-h-11 rounded-lg border border-current px-4 font-semibold disabled:opacity-50" onClick={() => void confirm()}>{pending ? words.checking : words.confirm}</button>
      <button type="button" className="min-h-11 text-sm underline" onClick={() => onBack({ address, city })}>{words.back}</button>
    </div>
  </fieldset>;
}
