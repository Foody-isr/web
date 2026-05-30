'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import type { ConfirmationAction, ConfirmationConfig } from '@/lib/types';

// Fallback labels for built-in actions if the owner left their label field empty.
const ACTION_DEFAULT_LABELS: Record<string, Record<string, string>> = {
  track_order:  { fr: 'Suivre ma commande',  en: 'Track my order',  he: 'מעקב הזמנה' },
  view_receipt: { fr: 'Voir le reçu',         en: 'View receipt',    he: 'הצג קבלה' },
  new_order:    { fr: 'Nouvelle commande',    en: 'Start a new order', he: 'הזמנה חדשה' },
  whatsapp:     { fr: 'Nous contacter sur WhatsApp', en: 'Message us on WhatsApp', he: 'צרו קשר ב-WhatsApp' },
};

function localised(map: Record<string, string> | undefined, locale: string): string {
  if (!map) return '';
  return map[locale] ?? map.en ?? map.fr ?? Object.values(map)[0] ?? '';
}

function actionLabel(action: ConfirmationAction, locale: string): string {
  return localised(action.label, locale) || localised(ACTION_DEFAULT_LABELS[action.id], locale) || action.id;
}

export type ConfirmationActionsCtx = {
  orderId: string;
  restaurantId: string;
  tableId?: string;
  sessionId?: string;
  receiptToken?: string;
  menuHref?: string;
};

// Build the live order-status tracker URL for the track_order action.
function trackerHref(ctx: ConfirmationActionsCtx): string {
  const params = new URLSearchParams({ restaurantId: ctx.restaurantId });
  if (ctx.tableId) params.set('tableId', ctx.tableId);
  if (ctx.sessionId) params.set('sessionId', ctx.sessionId);
  return `/order/tracking/${ctx.orderId}?${params.toString()}`;
}

// Resolve the destination URL for one action. Built-ins are routed; custom
// actions open the owner-supplied URL in a new tab.
function actionHref(
  action: ConfirmationAction,
  ctx: ConfirmationActionsCtx,
): { href: string; external: boolean } | null {
  if (!action.enabled) return null;
  if (action.kind === 'builtin') {
    switch (action.id) {
      case 'track_order':
        return { href: trackerHref(ctx), external: false };
      case 'view_receipt':
        return ctx.receiptToken ? { href: `/receipt/${ctx.receiptToken}`, external: false } : null;
      case 'new_order':
        return { href: ctx.menuHref ?? `/r/${ctx.restaurantId}`, external: false };
      case 'whatsapp': {
        const cfg = action.config ?? {};
        const phoneRaw = String((cfg.phone as string) ?? '').replace(/[^\d+]/g, '');
        if (!phoneRaw) return null;
        const phone = phoneRaw.replace(/^\+/, '');
        const messageTemplate = String((cfg.message as string) ?? '');
        const message = messageTemplate.replace('{order_id}', ctx.orderId);
        const qs = message ? `?text=${encodeURIComponent(message)}` : '';
        return { href: `https://wa.me/${phone}${qs}`, external: true };
      }
      default:
        return null;
    }
  }
  const url = String((action.config?.url as string) ?? '').trim();
  return url ? { href: url, external: true } : null;
}

// Default action set when the owner hasn't customised confirmation —
// matches what foodyweb showed before the builder shipped.
export const DEFAULT_CONFIRMATION_CONFIG: ConfirmationConfig = {
  actions: [
    { id: 'track_order',  kind: 'builtin', enabled: true },
    { id: 'view_receipt', kind: 'builtin', enabled: true },
    { id: 'new_order',    kind: 'builtin', enabled: true },
  ],
};

interface ConfirmationActionsProps {
  config: ConfirmationConfig | null | undefined;
  ctx: ConfirmationActionsCtx;
}

export function ConfirmationActions({ config, ctx }: ConfirmationActionsProps) {
  const { locale } = useI18n();
  if (!config) return null;
  return (
    <div className="space-y-2">
      {(config.actions ?? []).map((action) => {
        const resolved = actionHref(action, ctx);
        if (!resolved) return null;
        const label = actionLabel(action, locale);
        if (resolved.external) {
          return (
            <a
              key={action.id}
              href={resolved.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3 rounded-xl bg-[var(--surface)] border border-[var(--divider)] text-center text-[var(--text)] font-medium hover:border-brand hover:text-brand transition"
            >
              {label}
            </a>
          );
        }
        return (
          <Link
            key={action.id}
            href={resolved.href}
            className="block w-full py-3 rounded-xl bg-[var(--surface)] border border-[var(--divider)] text-center text-[var(--text)] font-medium hover:border-brand hover:text-brand transition"
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}

export function ConfirmationHeader({
  config, fallbackTitle, fallbackSubtitle,
}: {
  config: ConfirmationConfig | null | undefined;
  fallbackTitle: string;
  fallbackSubtitle?: string;
}) {
  const { locale } = useI18n();
  const title = localised(config?.title, locale) || fallbackTitle;
  const subtitle = localised(config?.subtitle, locale) || fallbackSubtitle;
  return (
    <header>
      <h1 className="text-2xl font-bold">{title}</h1>
      {subtitle && <p className="text-sm text-[var(--text-muted)] mt-1">{subtitle}</p>}
    </header>
  );
}

export function ConfirmationFAQList({ config }: { config: ConfirmationConfig | null | undefined }) {
  const { locale } = useI18n();
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  if (!config?.faq || config.faq.length === 0) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-xs uppercase tracking-wide text-[var(--text-muted)] font-semibold">
        FAQ
      </h3>
      <ul className="space-y-1.5">
        {config.faq.map((item, i) => {
          const question = localised(item.question, locale);
          const answer = localised(item.answer, locale);
          if (!question) return null;
          const open = openIdx === i;
          return (
            <li key={i} className="rounded-xl border border-[var(--divider)] bg-[var(--surface)]">
              <button
                type="button"
                onClick={() => setOpenIdx(open ? null : i)}
                className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-[var(--text)]"
              >
                <span>{question}</span>
                <span className="text-[var(--text-muted)] text-xs">{open ? '−' : '+'}</span>
              </button>
              {open && answer && (
                <div className="px-4 pb-3 text-sm text-[var(--text-muted)] whitespace-pre-line">
                  {answer}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// usePreviewConfirmationConfig listens to postMessage updates from the
// foodyadmin Confirmation editor while the tracking page is rendered in
// preview mode. Returns null when not in preview.
export function usePreviewConfirmationConfig(active: boolean): ConfirmationConfig | null {
  const [cfg, setCfg] = useState<ConfirmationConfig | null>(null);
  useEffect(() => {
    if (!active) return;
    function onMessage(e: MessageEvent) {
      const data = e.data;
      if (!data || data.type !== 'foody-checkout-preview') return;
      setCfg(((data.checkoutConfig as { confirmation?: ConfirmationConfig | null } | null)?.confirmation) ?? null);
    }
    window.addEventListener('message', onMessage);
    window.parent?.postMessage({ type: 'foody-checkout-preview-ready' }, '*');
    return () => window.removeEventListener('message', onMessage);
  }, [active]);
  return cfg;
}
