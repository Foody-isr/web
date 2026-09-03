"use client";

import { useEffect } from "react";
import { useI18n } from "@/lib/i18n";

/**
 * Publishes the open restaurant's currency into the locale context.
 *
 * The guest app reaches a restaurant through two doors — the server-rendered
 * `/r/[restaurantId]` layout and the client-side order flow — and prices are
 * rendered far from either. Rather than thread the code through every screen,
 * whichever door the guest came through mounts this once and every
 * `useCurrency()` below it formats in the right currency.
 *
 * Renders nothing.
 */
export function CurrencyBridge({ currency }: { currency?: string | null }) {
  const { setCurrency } = useI18n();

  useEffect(() => {
    setCurrency(currency);
    // `setCurrency` is recreated each render by the provider; depending on it
    // would re-run this on every parent render for no gain.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency]);

  return null;
}
