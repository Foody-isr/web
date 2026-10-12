"use client";

import { Suspense, use, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowPathIcon, CheckIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { PaymentReturnFrame } from "@/components/PaymentReturnFrame";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/constants";
import { hostedSignupDestination, waitForHostedSignup } from "@/lib/hosted-signup";
import { buildPaymentFailureURL, waitForPaymentReturn } from "@/lib/payment-return";
import { recalledOrderPage } from "@/lib/order-page-context";
import type { Restaurant } from "@/lib/types";
import { chargeSavedPaymentMethod, confirmHostedSignup, fetchOrder, fetchRestaurant, type HostedSignupResult } from "@/services/api";

type Stage = "verifying" | "charging" | "confirmed" | "delayed" | "pending" | "declined" | "error";

function SignupReturn({ restaurantId }: { restaurantId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const query = useSearchParams();
  const orderId = query.get("orderId") || "";
  const receipt = query.get("t");
  const requestedPage = query.get("pageSlug") || "";
  const [result, setResult] = useState<HostedSignupResult | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [pageSlug, setPageSlug] = useState(requestedPage);
  const [stage, setStage] = useState<Stage>("verifying");
  const [revision, setRevision] = useState(0);
  // No automatic payment replay, including after a timeout or a language change.
  const submitted = useRef(false);
  const paymentRead = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; paymentRead.current?.abort(); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const deadline = setTimeout(() => controller.abort(), 30_000);
    setStage("verifying");
    setResult(null);
    void (async () => {
      try {
        if (!/^[1-9]\d*$/.test(orderId)) throw new Error("invalid order");
        const loadedRestaurant = await fetchRestaurant(restaurantId, controller.signal);
        if (!active) return;
        setRestaurant(loadedRestaurant);
        const scope = String(loadedRestaurant.id);
        const slug = requestedPage || recalledOrderPage(scope, orderId) || "";
        setPageSlug(slug);
        const response = await waitForHostedSignup(
          () => confirmHostedSignup(orderId, scope, controller.signal),
          { signal: controller.signal },
        );
        if (!active) return;
        if (!response) throw new Error("verification interrupted");
        setResult(response);
        if (response.declined) { setStage("declined"); return; }
        if (!response.completed && !response.charge_attempted && !submitted.current) {
          if (!response.ready) { setStage("pending"); return; }
          // Fail closed against an older API. The server must explicitly confirm
          // the no-TZ capability before we continue the checkout-authorized debit.
          if (response.identity_required !== false || !response.payment_method_token_id || response.currency_code !== "ILS" || !Number.isSafeInteger(response.amount_minor) || response.amount_minor! <= 0) {
            throw new Error("registration is not eligible for token payment");
          }
          if (controller.signal.aborted) throw new Error("verification interrupted");
          submitted.current = true;
          setStage("charging");
          try {
            const charged = await chargeSavedPaymentMethod(orderId, scope, response.payment_method_token_id, controller.signal);
            if (!active) return;
            if (charged.declined) { router.replace(buildPaymentFailureURL(scope, orderId, receipt)); return; }
          } catch {
            // An interrupted POST may have charged the order. Only read its
            // authoritative status below; never repeat the debit.
          }
        }
        submitted.current = true;
        setStage("charging");
        const checked = await waitForPaymentReturn(
          () => fetchOrder(orderId, scope, receipt ?? undefined, controller.signal),
          { signal: controller.signal },
        );
        if (!active) return;
        if (checked.outcome === "confirmed") {
          setStage("confirmed");
          router.replace(hostedSignupDestination({ restaurantId: scope, orderId, receipt, pageSlug: slug, orderType: checked.order?.orderType }));
        } else if (checked.outcome === "declined") router.replace(buildPaymentFailureURL(scope, orderId, receipt));
        else setStage("delayed");
      } catch {
        if (active) setStage(submitted.current ? "delayed" : "error");
      } finally {
        clearTimeout(deadline);
      }
    })();
    return () => { active = false; controller.abort(); clearTimeout(deadline); };
  }, [orderId, restaurantId, receipt, requestedPage, revision, router]);

  // Read-only reconciliation stays here instead of opening a verification page.
  // Only API-owned paid/authorized states allow order confirmation.
  const checkPayment = async () => {
    if (!restaurant || !orderId || paymentRead.current) return;
    const controller = new AbortController();
    paymentRead.current = controller;
    const deadline = setTimeout(() => controller.abort(), 30_000);
    setStage("charging");
    try {
      const checked = await waitForPaymentReturn(
        () => fetchOrder(orderId, String(restaurant.id), receipt ?? undefined, controller.signal),
        { signal: controller.signal },
      );
      if (!mounted.current) return;
      if (checked.outcome === "confirmed") {
        setStage("confirmed");
        router.replace(hostedSignupDestination({ restaurantId: String(restaurant.id), orderId, receipt, pageSlug, orderType: checked.order?.orderType }));
      } else if (checked.outcome === "declined") {
        router.replace(buildPaymentFailureURL(String(restaurant.id), orderId, receipt));
      } else setStage("delayed");
    } catch {
      if (mounted.current) setStage("delayed");
    } finally {
      clearTimeout(deadline);
      paymentRead.current = null;
    }
  };

  const loading = stage === "verifying" || stage === "charging" || stage === "confirmed";
  const currentStep = stage === "confirmed" ? 2 : submitted.current || stage === "delayed" ? 1 : 0;
  const titleKey = {
    verifying: "hostedSignupVerifying", charging: "hostedSignupProcessing",
    confirmed: "hostedSignupConfirmed", delayed: "paymentVerificationDelayed", pending: "hostedSignupCheck",
    declined: "hostedSignupDeclinedTitle", error: "hostedSignupCheck",
  }[stage];
  const helpKey = {
    verifying: "hostedSignupVerifyingHelp", charging: "hostedSignupProcessingHelp",
    confirmed: "hostedSignupConfirmedHelp", delayed: "hostedSignupChargeUnknown", pending: "hostedSignupPending",
    declined: "hostedSignupDeclined", error: "hostedSignupError",
  }[stage];
  const trackingQuery = new URLSearchParams({ restaurantId: String(restaurant?.id || restaurantId) });
  if (receipt) trackingQuery.set("t", receipt);
  if (pageSlug) trackingQuery.set("pageSlug", pageSlug);

  return (
    <PaymentReturnFrame restaurant={restaurant} pageSlug={pageSlug}>
      <ol aria-label={t("hostedSignupProgress")} className="mb-10 grid grid-cols-3 gap-3 text-xs sm:gap-6 sm:text-sm">
        {["hostedSignupCardStep", "commercePayment", "hostedSignupConfirmationStep"].map((key, index) => (
          <li key={key} aria-current={index === currentStep ? "step" : undefined}
            className={`flex min-w-0 flex-col gap-3 border-t-2 pt-3 ${index <= currentStep ? "border-[var(--text)]" : "border-[var(--divider)] text-[var(--text-muted)]"}`}>
            <span className="flex items-center gap-2 font-medium">
              {index < currentStep ? <CheckIcon className="h-4 w-4 shrink-0" aria-hidden="true" /> : <span aria-hidden="true">{index + 1}.</span>}
              {t(key)}
            </span>
          </li>
        ))}
      </ol>
      <p className="mb-3 text-sm text-[var(--text-muted)]">{t("order")} #{orderId}</p>
      <section aria-labelledby="signup-title" className="space-y-6">
        <div role="status" aria-live="polite" aria-atomic="true" className="space-y-3">
          {loading && <ArrowPathIcon className="mb-6 h-9 w-9 motion-safe:animate-spin" aria-hidden="true" />}
          <h1 id="signup-title" className="text-2xl font-semibold leading-tight sm:text-3xl">{t(titleKey)}</h1>
          <p className="text-sm leading-6 text-[var(--text-muted)] sm:text-base">{t(helpKey)}</p>
        </div>
        {stage === "charging" && result?.amount_minor && result.currency_code === "ILS" ? (
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <span className="text-sm">{t("hostedSignupOrderAmount")}</span>
              <bdi className="text-2xl font-semibold tabular-nums">{formatMoney(result.amount_minor / 100, result.currency_code)}</bdi>
            </div>
        ) : null}
        {!loading && (
          <div className="space-y-3">
            {stage === "delayed" ? <>
              <button type="button" onClick={() => void checkPayment()} className="commerce-primary">{t("hostedSignupCheckPayment")}</button>
              <Link href={`/order/tracking/${orderId}?${trackingQuery}`} className="commerce-secondary">{t("trackOrderStatus")}</Link>
            </> : <>
              <button type="button" onClick={() => setRevision((value) => value + 1)} className="commerce-primary">{t("hostedSignupCheck")}</button>
              {stage === "declined" && restaurant && <Link href={buildPaymentFailureURL(String(restaurant.id), orderId, receipt)} className="commerce-secondary">{t("hostedSignupBackToPayment")}</Link>}
            </>}
          </div>
        )}
      </section>
      <p className="mt-8 flex items-start gap-2 text-xs leading-5 text-[var(--text-muted)]">
        <LockClosedIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{t("paymentSecureNote")}
      </p>
    </PaymentReturnFrame>
  );
}

function SignupLoading() {
  const { t } = useI18n();
  return <main className="commerce-surface flex min-h-screen items-center justify-center bg-[var(--bg-page)] p-6">
    <p role="status" className="flex items-center gap-3"><ArrowPathIcon className="h-6 w-6 motion-safe:animate-spin" aria-hidden="true" />{t("hostedSignupVerifying")}</p>
  </main>;
}

function SignupContext({ restaurantId }: { restaurantId: string }) {
  const query = useSearchParams();
  // Leaving an order cancels its reads. A
  // language change does neither and can never trigger another payment.
  const contextKey = [restaurantId, query.get("orderId"), query.get("t"), query.get("pageSlug")].join(":");
  return <SignupReturn key={contextKey} restaurantId={restaurantId} />;
}

/** Completes hosted card registration in the restaurant's checkout context. */
export default function SignupPage({ params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = use(params);
  return <Suspense fallback={<SignupLoading />}><SignupContext restaurantId={restaurantId} /></Suspense>;
}
