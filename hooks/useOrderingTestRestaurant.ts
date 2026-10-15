'use client';

import { useEffect, useState } from 'react';
import type { Restaurant } from '@/lib/types';
import { fetchRestaurant } from '@/services/api';
import { hasOrderingTestAccess } from '@/lib/availability';

type Access = Pick<Restaurant, 'id' | 'orderingTestAccessExpiresAt' | 'rushMode' | 'ordersPaused'>;

/** Refreshes visitor-only access after SSR and removes it at its exact deadline. */
export function useOrderingTestRestaurant(initial: Restaurant, disabled = false): Restaurant {
  const [access, setAccess] = useState<Access>();
  useEffect(() => {
    if (disabled) return;
    let current = true;
    const refresh = () => {
      void fetchRestaurant(String(initial.id)).then(value => {
        if (current) setAccess({ id: value.id, orderingTestAccessExpiresAt: value.orderingTestAccessExpiresAt, rushMode: value.rushMode, ordersPaused: value.ordersPaused });
      }).catch(() => { if (current) setAccess(undefined); });
    };
    refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => { current = false; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [initial.id, disabled]);
  const matching = !disabled && access?.id === initial.id ? access : undefined;
  const expiry = matching?.orderingTestAccessExpiresAt;
  useEffect(() => {
    if (!expiry) return;
    const timer = window.setTimeout(() => setAccess(current => current?.orderingTestAccessExpiresAt === expiry ? { ...current, orderingTestAccessExpiresAt: undefined } : current), Math.max(0, Date.parse(expiry) - Date.now()));
    return () => clearTimeout(timer);
  }, [expiry]);
  const active = !!matching && hasOrderingTestAccess(matching);
  return { ...initial, ...(matching ?? {}), orderingTestAccessExpiresAt: active ? expiry : undefined, rushMode: active ? false : matching?.rushMode ?? initial.rushMode, ordersPaused: active ? false : matching?.ordersPaused ?? initial.ordersPaused };
}
