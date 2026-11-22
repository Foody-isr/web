"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageAppearanceScope } from "@/components/PageAppearanceScope";
import { useOrderRoutePage } from "@/hooks/useOrderRoutePage";
import { useCurrency, useI18n } from "@/lib/i18n";
import { useResolvedTheme } from "@/lib/themes/useResolvedTheme";
import { verifoneIframeEvent, verifoneIframeOrigin } from "@/lib/verifone-iframe";
import { fetchRestaurant, fetchVerifoneIframe } from "@/services/api";

/** Display Verifone's own form while polling Foody for the confirmed order state. */
export function EmbeddedPayment({ orderId, restaurantId, token, pageSlug, summaryHref }: {
  orderId: string;
  restaurantId: string;
  token: string;
  pageSlug: string;
  summaryHref: string;
}) {
  const router = useRouter();
  const { t, direction } = useI18n();
  const { money } = useCurrency();
  const { resolved, config } = useResolvedTheme();
  const frame = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [providerError, setProviderError] = useState(false);
  const [openedInTab, setOpenedInTab] = useState(false);
  const [watching, setWatching] = useState(true);

  const restaurant = useQuery({
    queryKey: ["order-theme-restaurant", restaurantId],
    queryFn: () => fetchRestaurant(restaurantId),
  }).data;
  const sourcePage = useOrderRoutePage(restaurantId, pageSlug, true).data;
  const status = useQuery({
    queryKey: ["verifone-iframe", restaurantId, orderId, token],
    queryFn: ({ signal }) => fetchVerifoneIframe(orderId, restaurantId, token, signal),
    retry: false,
    refetchInterval: query => {
      const state = query.state.data?.state;
      return watching && (state === "ready" || state === "pending") ? submitted ? 1_500 : 4_000 : false;
    },
  });
  const state = status.data?.state;
  const session = status.data?.state === "ready" ? status.data : null;
  const origin = session ? verifoneIframeOrigin(session.url) : null;
  const refetch = status.refetch;

  useEffect(() => {
    const timer = window.setTimeout(() => setWatching(false), 17 * 60_000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (state === "paid" || state === "authorized") router.replace(summaryHref);
  }, [router, state, summaryHref]);

  useEffect(() => {
    if (!origin) return;
    const onMessage = (event: MessageEvent) => {
      const type = verifoneIframeEvent(event, frame.current?.contentWindow ?? null, origin);
      if (type === "CHECKOUT_COMPLETED") setSubmitted(true);
      else if (type === "CHECKOUT_FAILED") setProviderError(true);
      if (type) void refetch();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [origin, refetch]);

  const showForm = session && origin && !submitted && !openedInTab;
  const unavailable = state === "unavailable" || state === "closed" || (session && !origin) || (status.isError && !state);
  const waitingText = unavailable ? "embeddedPaymentUnavailable" :
    openedInTab && !submitted ? "embeddedPaymentOpened" :
    showForm || status.isPending ? "embeddedPaymentLoading" : "paymentVerifying";

  return <PageAppearanceScope appearance={sourcePage?.appearance_overrides} surface="checkout"
    palette={{ ...resolved?.theme.tokens.colors, ...config?.customPalette }}>
    <main className="commerce-surface min-h-screen bg-[var(--bg-page)] pb-8 text-[var(--text)]" dir={direction}>
      <header className="commerce-header">
        <Link href={summaryHref} className="inline-flex items-center gap-2 text-sm sm:text-base">
          <span aria-hidden="true" className="rtl:rotate-180">←</span>{t("viewOrder")}
        </Link>
        <span className="commerce-logo">
          {restaurant?.logoUrl ? <Image src={restaurant.logoUrl} alt={restaurant.name} width={120} height={48}
            className="max-h-12 w-auto object-contain" /> : restaurant?.name}
        </span>
        <span />
      </header>
      <section className="mx-auto w-full max-w-2xl px-4 pt-6 sm:px-6 sm:pt-10" aria-labelledby="payment-title">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h1 id="payment-title" className="commerce-title !mb-0">{t("embeddedPaymentTitle")}</h1>
          {session && <strong className="text-lg tabular-nums" dir="ltr">{money(session.amount_minor / 100)}</strong>}
        </div>
        {showForm ? (
          <>
            <div className="relative overflow-hidden rounded-lg border border-[var(--divider)] bg-[var(--surface)]" aria-busy={!loaded}>
              {!loaded && <p role="status" className="absolute inset-x-0 top-8 text-center text-sm text-[var(--text-muted)]">{t(waitingText)}</p>}
              <iframe ref={frame} src={session.url} title={t("embeddedPaymentTitle")}
                className={`block w-full border-0 [height:clamp(38rem,76svh,46rem)] ${loaded ? "" : "opacity-0"}`}
                onLoad={() => setLoaded(true)}
                sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                allow="payment" referrerPolicy="origin" />
            </div>
            {providerError && <p className="mt-3 text-sm" role="status">{t("embeddedPaymentCheck")}</p>}
          </>
        ) : <p className="min-h-24 rounded-lg border border-[var(--divider)] p-5 text-sm"
          role={unavailable ? "alert" : "status"}>{t(waitingText)}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <button type="button" className="commerce-edit min-h-11" onClick={() => void refetch()} disabled={status.isFetching}>
            {t("embeddedPaymentCheckStatus")}
          </button>
          {showForm && <a href={session.url} target="_blank" rel="noopener noreferrer"
            className="commerce-edit flex min-h-11 items-center" onClick={() => setOpenedInTab(true)}>{t("embeddedPaymentOpenTab")}</a>}
        </div>
      </section>
    </main>
  </PageAppearanceScope>;
}
