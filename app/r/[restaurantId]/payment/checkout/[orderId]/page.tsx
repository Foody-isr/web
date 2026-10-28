"use client";

import { use, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { preparedCheckoutItems } from '@/lib/internal-checkout';
import { fetchInternalCheckout, payInternalCheckout, quoteInternalCheckout, type InternalCheckout } from '@/services/api';

/** Reviews the server-owned basket and collects details before hosted Sumit payment. */
export default function PreparedCheckout({ params }: { params: Promise<{ restaurantId: string; orderId: string }> }) {
  const { restaurantId, orderId } = use(params);
  const search = useSearchParams();
  const token = search.get('t') || '';
  const { t, locale, direction } = useI18n();
  const [checkout, setCheckout] = useState<InternalCheckout | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [quote, setQuote] = useState<{ delivery_fee: number; discount_amount: number; total: number } | null>(null);
  const [quoteError, setQuoteError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setCheckout(null); setError(false); setQuote(null);
    if (!token) { setError(true); return; }
    fetchInternalCheckout(restaurantId, orderId, token, controller.signal)
      .then(result => { if (!controller.signal.aborted) setCheckout(result); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [restaurantId, orderId, token, attempt]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !checkout || checkout.paid) return;
    const form = new FormData(event.currentTarget);
    const details: Record<string, string> = { locale };
    for (const key of ['name', 'phone', 'email', 'address', 'city', 'floor', 'apartment', 'entry_code', 'notes']) {
      const value = form.get(key);
      if (typeof value === 'string') details[key] = value.trim();
    }
    setBusy(true); setError(false); setQuoteError(false);
    if (checkout.mode === 'link' && checkout.order_type === 'delivery' && !checkout.started && !quote) {
      try { setQuote(await quoteInternalCheckout(restaurantId, orderId, token, details)); }
      catch { setQuoteError(true); }
      finally { setBusy(false); }
      return;
    }
    try {
      const url = await payInternalCheckout(restaurantId, orderId, token, { ...details, ...(quote ? { expected_total_minor: Math.round(quote.total * 100) } : {}) });
      window.location.assign(url);
    } catch { setError(true); setQuote(null); setBusy(false); }
  }

  const money = (amount: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: checkout?.currency || 'ILS' }).format(amount);
  const lines = preparedCheckoutItems(checkout?.items || []);
  const needsDetails = checkout?.mode === 'link' && !checkout.started;
  const displayed = quote || checkout;
  const mustQuote = needsDetails && checkout?.order_type === 'delivery';
  const inputClass = 'mt-1 w-full rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-3 text-[var(--text)]';
  const confirmationURL = `/order/confirmation/${encodeURIComponent(orderId)}?${new URLSearchParams({ restaurantId, t: token })}`;
  return <main dir={direction} style={{ fontFamily: 'var(--font-body, system-ui), sans-serif' }} className="min-h-screen bg-[var(--bg-page)] px-4 py-8 text-[var(--text)]">
    <div className="mx-auto max-w-3xl">
      <header className="mb-6"><p className="mb-2 text-sm font-semibold">Foody</p><h1 className="text-2xl font-bold">{t('preparedCheckoutTitle')}</h1></header>
      {error && <div role="alert" className="mb-4 rounded-xl border border-red-300 p-4"><p>{t(checkout ? 'preparedCheckoutPaymentError' : 'preparedCheckoutUnavailable')}</p>
        <button type="button" onClick={() => setAttempt(value => value + 1)} className="mt-3 underline">{t('preparedCheckoutRefresh')}</button></div>}
      {!checkout && !error && <p role="status">{t('loading')}</p>}
      {checkout?.paid && <div role="status"><h2 className="mb-4 text-xl font-semibold">{t('preparedCheckoutPaid')}</h2><a href={confirmationURL} className="underline">{t('preparedCheckoutViewOrder')}</a></div>}
      {checkout && !checkout.paid && <form onSubmit={submit} onChange={() => { setQuote(null); setQuoteError(false); }} className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-5">
          <h2 className="mb-4 text-lg font-semibold">{t('preparedCheckoutBasket')}</h2>
          <ul className="divide-y divide-[var(--divider)]">{lines.map(line => <li key={line.id} className="py-3"><div className="flex justify-between gap-3"><span>{line.quantity} × {line.name}</span><span className="whitespace-nowrap">{money(line.total)}</span></div>{line.details.map((detail, index) => <p key={index} className="mt-1 text-sm opacity-70">{detail}</p>)}</li>)}</ul>
          {!!displayed?.discount_amount && <p className="mt-4 flex justify-between"><span>{t('preparedCheckoutDiscount')}</span><span>−{money(displayed?.discount_amount || 0)}</span></p>}
          {checkout.order_type === 'delivery' && <p className="mt-4 flex justify-between"><span>{t('deliveryFee')}</span><span>{quote || checkout.started ? money(displayed?.delivery_fee || 0) : t('preparedCheckoutFeeToCalculate')}</span></p>}
          <p className="mt-4 flex justify-between text-lg font-bold"><span>{t(mustQuote && !quote ? 'preparedCheckoutBeforeDelivery' : 'total')}</span><span>{money(mustQuote && !quote ? (checkout.total || 0) - (checkout.delivery_fee || 0) : displayed?.total || 0)}</span></p>
          <p className="mt-4 text-sm">{t(checkout.order_type === 'delivery' ? 'delivery' : 'pickup')}{checkout.scheduled_for && <> · <bdi dir="ltr">{checkout.scheduled_for.slice(0, 10)}</bdi></>}{checkout.window_start && <> · <bdi dir="ltr">{checkout.window_start}–{checkout.window_end || ''}</bdi></>}</p>
          <p className="mt-3 text-sm opacity-70">{t('preparedCheckoutFixedBasket')}</p>
          {quote && <p role="status" className="mt-3 text-sm font-semibold">{t('preparedCheckoutQuoteReady')}</p>}
        </section>
        <section className="rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-5">
          {needsDetails && <fieldset disabled={busy} className="flex flex-col gap-4">
            <legend className="mb-4 text-lg font-semibold">{t('preparedCheckoutDetails')}</legend>
            <label>{t('preparedCheckoutName')}<input name="name" autoComplete="name" required maxLength={120} className={inputClass} /></label>
            <label>{t('preparedCheckoutPhone')}<input name="phone" type="tel" autoComplete="tel" required minLength={7} maxLength={40} className={inputClass} /></label>
            <label>{t('preparedCheckoutEmail')}<input name="email" type="email" autoComplete="email" maxLength={254} className={inputClass} /></label>
            {checkout.order_type === 'delivery' && <>
              <label>{t('preparedCheckoutAddress')}<input name="address" autoComplete="street-address" required maxLength={500} className={inputClass} /></label>
              <label>{t('preparedCheckoutCity')}<input name="city" autoComplete="address-level2" maxLength={100} className={inputClass} /></label>
              <label>{t('preparedCheckoutFloor')}<input name="floor" maxLength={30} className={inputClass} /></label>
              <label>{t('preparedCheckoutApartment')}<input name="apartment" maxLength={30} className={inputClass} /></label>
              <label>{t('preparedCheckoutEntryCode')}<input name="entry_code" maxLength={100} className={inputClass} /></label>
              <label>{t('preparedCheckoutNotes')}<textarea name="notes" maxLength={1000} className={inputClass} /></label>
            </>}
          </fieldset>}
          {quoteError && <p role="alert" className="my-3 text-red-700">{t('preparedCheckoutQuoteError')}</p>}
          <p className="my-4 text-sm opacity-70">{t('preparedCheckoutSecure')}</p>
          <button disabled={busy} className="w-full rounded-xl bg-[var(--brand)] px-4 py-3 font-bold text-white disabled:opacity-50">{t(busy ? 'preparedCheckoutOpening' : checkout.started ? 'preparedCheckoutResume' : mustQuote && !quote ? 'preparedCheckoutCalculate' : 'preparedCheckoutPay')}</button>
        </section>
      </form>}
    </div>
  </main>;
}
