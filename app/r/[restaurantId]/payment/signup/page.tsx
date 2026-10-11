"use client";

import { Suspense, use, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LanguageToggle } from "@/components/LanguageToggle";
import { CardholderIdentityField } from "@/components/CardholderIdentityField";
import { CreditCardIcon } from "@heroicons/react/24/outline";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/constants";
import { validSavedCardIdentity } from "@/lib/checkout-payment";
import { chargeSavedPaymentMethod, confirmHostedSignup, fetchRestaurant, type HostedSignupResult } from "@/services/api";

function SignupReturn({ restaurantId }: { restaurantId: string }) {
  const { t, direction } = useI18n();
  const router = useRouter();
  const query = useSearchParams();
  const orderId = query.get("orderId");
  const receipt = query.get("t");
  const [result, setResult] = useState<HostedSignupResult | null>(null);
  const [scope, setScope] = useState("");
  const [identity, setIdentity] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  // A network failure is not permission to resubmit a payment, even in this tab.
  const submitted = useRef(false);
  const [chargeAttempted, setChargeAttempted] = useState(false);
  const returnPath = (outcome: "success" | "failed", id = scope) =>
    `/r/${id}/payment/${outcome}?${new URLSearchParams({ orderId: orderId || "", ...(receipt ? { t: receipt } : {}) })}`;

  useEffect(() => {
    let active = true;
    setBusy(true);
    setMessage("");
    setResult(null);
    void (async () => {
      try {
        if (!orderId || !/^\d+$/.test(orderId)) throw new Error("invalid order");
        const restaurant = await fetchRestaurant(restaurantId);
        const response = await confirmHostedSignup(orderId, String(restaurant.id));
        if (!active) return;
        setScope(String(restaurant.id));
        setResult(response);
        if (response.completed) {
          router.replace(`/r/${restaurant.id}/payment/success?${new URLSearchParams({ orderId, ...(receipt ? { t: receipt } : {}) })}`);
        } else if (response.declined) setMessage(t("hostedSignupDeclined"));
        else if (!response.ready) setMessage(t("hostedSignupPending"));
      } catch {
        if (active) setMessage(t("hostedSignupError"));
      } finally {
        if (active) setBusy(false);
      }
    })();
    return () => { active = false; };
  }, [orderId, restaurantId, receipt, revision, router, t]);

  const pay = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitted.current || busy || !result?.ready || result.declined || !result.payment_method_token_id || !orderId || !scope) return;
    if (!validSavedCardIdentity(identity)) { setMessage(t("savedCardIdentityInvalid")); return; }
    submitted.current = true;
    setChargeAttempted(true);
    setBusy(true);
    setMessage("");
    try {
      const response = await chargeSavedPaymentMethod(orderId, scope, result.payment_method_token_id, identity);
      if (response.completed) router.replace(returnPath("success"));
      else if (response.declined) router.replace(returnPath("failed"));
      else setMessage(t("hostedSignupChargeUnknown"));
    } catch {
      setMessage(t("hostedSignupChargeUnknown"));
    } finally {
      setIdentity("");
      setBusy(false);
    }
  };

  return (
    <main dir={direction} className="min-h-screen bg-[var(--bg-page)] px-5 py-8 text-[var(--text)]">
      <div className="mx-auto max-w-md space-y-6">
        <LanguageToggle />
        <h1 className="text-2xl font-bold">{t(result?.declined ? "hostedSignupDeclinedTitle" : result?.ready ? "hostedSignupTitle" : "hostedSignupCheck")}</h1>
        {message && <p role="status" className="text-sm leading-relaxed">{message}</p>}
        {result?.ready && !result.declined && !chargeAttempted && result.currency_code === "ILS" && typeof result.amount_minor === "number" ? (
          <form onSubmit={pay} className="space-y-5 rounded-2xl border-2 border-[var(--text)] bg-[var(--surface)] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">{t("savedCardsTitle")}</h2>
              <CreditCardIcon className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="text-sm leading-relaxed text-[var(--text-muted)]">{t("hostedSignupReadyHelp")}</p>
            <CardholderIdentityField id="signup-identity" value={identity} onChange={setIdentity} disabled={busy} />
            <button type="submit" disabled={busy || !validSavedCardIdentity(identity)} className="w-full rounded-xl bg-[var(--brand)] px-5 py-4 font-semibold text-[var(--ink-on-accent,#ffffff)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand)] disabled:opacity-50">
              {t("hostedSignupPay").replace("{amount}", formatMoney(result.amount_minor / 100, result.currency_code))}
            </button>
          </form>
        ) : !chargeAttempted && !result?.completed && (
          <div className="flex flex-wrap gap-3">
            {result?.declined && scope && <button onClick={() => router.replace(returnPath("failed"))} className="rounded-xl bg-[var(--brand)] px-5 py-3 font-semibold text-[var(--ink-on-accent,#ffffff)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand)]">{t("hostedSignupBackToPayment")}</button>}
            <button disabled={busy} onClick={() => setRevision((value) => value + 1)} className="rounded-xl border border-[var(--divider)] px-5 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand)] disabled:opacity-50">{t("hostedSignupCheck")}</button>
          </div>
        )}
        {chargeAttempted && scope && <button onClick={() => router.replace(returnPath("success"))} className="rounded-xl border px-5 py-3">{t("viewOrder")}</button>}
      </div>
    </main>
  );
}

export default function SignupPage({ params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = use(params);
  return <Suspense><SignupReturn restaurantId={restaurantId} /></Suspense>;
}
