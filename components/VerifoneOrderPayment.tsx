"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { chargeEncryptedCard, chargeVerifoneWallet, fetchEncryptedCardPaymentStatus, fetchPaymentCapabilities } from "@/services/api";
import { VerifoneCardCapture, VerifoneCardInputError, type VerifoneCardCaptureHandle } from "./VerifoneCardCapture";
import { CheckoutWalletButtons } from "./CheckoutWalletButtons";
import type { VerifoneWallet } from "@/lib/types";
import { requestAppleWallet, requestGoogleWallet, type GoogleWalletClient } from "@/lib/verifone-wallet";

type Props = {
  orderId: string;
  restaurantId: string;
  receiptToken: string;
  merchantName?: string;
  total: number;
  onPaid(saveFailed?: boolean): void;
};

/** Resumes payment for the same order once its last attempt is known to be safe to retry. */
export function VerifoneOrderPayment({ orderId, restaurantId, receiptToken, merchantName, total, onPaid }: Props) {
  const { t } = useI18n();
  const capture = useRef<VerifoneCardCaptureHandle>(null);
  const submitLock = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const status = useQuery({
    queryKey: ["verifone-order-payment", restaurantId, orderId],
    queryFn: () => fetchEncryptedCardPaymentStatus(orderId, restaurantId, receiptToken),
    gcTime: 0,
    retry: false,
    refetchInterval: (query) => query.state.data?.state === "pending" ? 5_000 : false,
  });
  const paymentState = status.data?.state;
  useEffect(() => {
    if (paymentState === "paid") onPaid();
  }, [paymentState, onPaid]);
  const wallet = status.data?.wallet_type;
  const capabilities = useQuery({
    queryKey: ["checkout-payment-capabilities", restaurantId],
    queryFn: () => fetchPaymentCapabilities(restaurantId),
    enabled: status.data?.state === "ready" && !!wallet,
    retry: false,
  });
  const wallets = capabilities.data?.wallets;

  const payWithWallet = (method: VerifoneWallet, google?: GoogleWalletClient) => {
    if (submitLock.current || method !== wallet || status.data?.state !== "ready") return;
    const amount = Math.round(total * 100);
    if (!Number.isSafeInteger(amount) || amount <= 0) return;
    const config = wallets?.google_pay;
    if (method === "GOOGLE_PAY" && (!config || !google)) return;
    submitLock.current = true;
    setSubmitting(true);
    setError("");
    const charge = async (token: object) => {
      try {
        return (await chargeVerifoneWallet(orderId, restaurantId, receiptToken, method, token, amount)).completed;
      } catch {
        // The current order status controls any later retry.
        return false;
      }
    };
    const payment = method === "APPLE_PAY"
      ? requestAppleWallet(restaurantId, merchantName || "Foody", amount, charge)
      : requestGoogleWallet(google!, config!, amount).then(async (token) => { if (token) await charge(token); });
    void payment.catch(() => setError(t("paymentServiceUnavailable"))).finally(async () => {
      await status.refetch();
      submitLock.current = false;
      setSubmitting(false);
    });
  };

  const pay = async () => {
    if (submitLock.current || !capture.current || status.data?.state !== "ready" || status.isError) return;
    submitLock.current = true;
    setSubmitting(true);
    setError("");
    try {
      const encrypted = await capture.current.prepare();
      try {
        const result = await chargeEncryptedCard(orderId, restaurantId, encrypted, receiptToken);
        if (result.completed && result.card_save_unavailable) onPaid(true);
      } catch {
        // The status read decides whether another attempt is safe.
      } finally {
        encrypted.encrypted_card = encrypted.encrypted_identity_card_number = "";
      }
      await status.refetch();
    } catch (err) {
      if (!(err instanceof VerifoneCardInputError)) setError(err instanceof Error ? err.message : t("paymentServiceUnavailable"));
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  if (status.isError || status.data?.state === "unavailable") {
    return <p role="status" className="commerce-notice">
      {t("paymentServiceUnavailable")}{" "}
      <button type="button" className="underline" onClick={() => void status.refetch()}>{t("tryAgain")}</button>
    </p>;
  }
  if (status.data?.state === "paid") return <p role="status" className="commerce-notice">{t("paymentSuccess")}</p>;
  if (status.data?.state === "closed") return null;
  if (status.data?.state !== "ready") return <p role="status" className="commerce-notice">{t("verifonePaymentVerification")}</p>;
  if (wallet && capabilities.isPending) return <p role="status" className="commerce-notice">{t("processing")}</p>;
  if (wallet) return (
    <section className="space-y-3">
      {status.data.declined && <p role="alert" className="commerce-notice">{t("walletDeclined")}</p>}
      <CheckoutWalletButtons wallets={wallet === "APPLE_PAY" ? { apple_pay: wallets?.apple_pay } : { google_pay: wallets?.google_pay }}
        disabled={submitting} onPay={payWithWallet} unavailableMessage={t("walletRetryUnavailable")} />
      {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
    </section>
  );
  return (
    <section className="space-y-3">
      {status.data.declined && <p role="alert" className="commerce-notice">{t("verifonePaymentDeclined")}</p>}
      <div className="rounded-[16px] border border-[var(--divider)] bg-[var(--surface)] p-4">
        <VerifoneCardCapture ref={capture} restaurantId={restaurantId} disabled={submitting} />
      </div>
      {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
      <button type="button" className="commerce-primary" disabled={submitting} onClick={() => void pay()}>
        {submitting ? t("processing") : t("payNow")}
      </button>
    </section>
  );
}
