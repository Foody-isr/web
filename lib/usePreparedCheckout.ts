"use client";

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { fetchInternalCheckout, payInternalCheckout, quoteInternalCheckout, type InternalCheckout, type InternalCheckoutDetails } from '@/services/api';

type Quote = { delivery_fee: number; discount_amount: number; total: number };

/** Keeps a prepared order isolated from the saved cart and reuses its single payment attempt. */
export function usePreparedCheckout(restaurantId: string, orderId: string, token: string, active: boolean) {
  const scope = JSON.stringify([restaurantId, orderId, token]);
  const [basket, setBasket] = useState<{ scope: string; data: InternalCheckout } | null>(null);
  const [failedScope, setFailedScope] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [errorStage, setErrorStage] = useState<'quote' | 'payment'>('payment');
  const [reviewed, setReviewed] = useState<{ scope: string; address: string; value: Quote } | null>(null);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    if (!token) { setFailedScope(scope); return; }
    setFailedScope('');
    fetchInternalCheckout(restaurantId, orderId, token, controller.signal)
      .then(data => { if (!controller.signal.aborted) setBasket({ scope, data }); })
      .catch(() => { if (!controller.signal.aborted) setFailedScope(scope); });
    return () => controller.abort();
  }, [active, restaurantId, orderId, token, scope, attempt]);
  const data = active && basket?.scope === scope ? basket.data : undefined;
  const addressKey = (details: InternalCheckoutDetails) => JSON.stringify([details.address?.trim(), details.city?.trim()]);
  const quoteFor = (details: InternalCheckoutDetails) => reviewed?.scope === scope && reviewed.address === addressKey(details) ? reviewed.value : undefined;
  const mutation = useMutation({
    retry: false,
    mutationFn: async (details: InternalCheckoutDetails) => {
      if (!active || !data || data.paid) throw new Error('Checkout unavailable');
      const quote = quoteFor(details);
      if (!data.started && data.mode === 'link' && data.order_type === 'delivery' && !quote) {
        setErrorStage('quote');
        const value = await quoteInternalCheckout(restaurantId, orderId, token, details);
        setReviewed({ scope, address: addressKey(details), value });
        return;
      }
      setErrorStage('payment');
      const paymentURL = await payInternalCheckout(restaurantId, orderId, token,
        data.started ? {} : { ...details, ...(quote ? { expected_total_minor: Math.round(quote.total * 100) } : {}) });
      window.location.assign(paymentURL);
    },
    onError: () => { setReviewed(null); },
  });
  return { data, loading: active && !data && failedScope !== scope, unavailable: active && failedScope === scope,
    quoteFor, mutation, errorStage, refresh: () => { setReviewed(null); mutation.reset(); setBasket(null); setFailedScope(''); setAttempt(value => value + 1); } };
}
