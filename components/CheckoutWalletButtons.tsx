"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { VerifoneWallet } from "@/lib/types";
import { canUseApplePay, googleWalletMethod, readyGooglePay, type GoogleWalletClient } from "@/lib/verifone-wallet";
import type { VerifoneWalletCapabilities } from "@/services/api";

type Props = {
  wallets?: VerifoneWalletCapabilities;
  disabled: boolean;
  unavailableMessage?: string;
  onPay(wallet: VerifoneWallet, google?: GoogleWalletClient): void;
};

/** Renders official wallet buttons after the provider and browser both support them. */
export function CheckoutWalletButtons({ wallets, disabled, onPay, unavailableMessage }: Props) {
  const { locale, t } = useI18n();
  const googleEnvironment = wallets?.google_pay?.environment;
  const [supportsApple, setSupportsApple] = useState(false);
  const [google, setGoogle] = useState<{ environment: string; client: GoogleWalletClient } | null>(null);
  const googleHost = useRef<HTMLDivElement>(null);
  const onPayRef = useRef(onPay);

  useEffect(() => { onPayRef.current = onPay; }, [onPay]);
  useEffect(() => {
    setSupportsApple(!!wallets?.apple_pay && window.self === window.top && canUseApplePay());
  }, [wallets?.apple_pay]);
  useEffect(() => {
    let active = true;
    if (googleEnvironment && window.self === window.top) {
      void readyGooglePay(googleEnvironment).then((client) => {
        if (active && client) setGoogle({ environment: googleEnvironment, client });
      }).catch(() => { if (active) setGoogle(null); });
    }
    return () => { active = false; };
  }, [googleEnvironment]);

  const client = google?.environment === googleEnvironment ? google?.client : undefined;
  const apple = !!wallets?.apple_pay && supportsApple;
  useEffect(() => {
    const host = googleHost.current;
    if (!host || !client) return;
    try {
      const button = client.createButton({
        onClick: () => onPayRef.current("GOOGLE_PAY", client),
        buttonType: "pay",
        buttonColor: "black",
        buttonLocale: locale,
        buttonSizeMode: "fill",
        allowedPaymentMethods: [googleWalletMethod],
      });
      host.replaceChildren(button);
      return () => button.remove();
    } catch {
      setGoogle(null);
    }
  }, [client, locale]);

  if (!apple && !client) return unavailableMessage ? <p role="status" className="text-sm text-[var(--text-muted)]">{unavailableMessage}</p> : null;
  return (
    <div data-checkout-wallets className={`grid min-w-0 grid-cols-1 gap-3 ${apple && client ? "sm:grid-cols-2" : ""}`}>
      {apple && <button type="button" lang={locale} disabled={disabled} className="checkout-apple-pay"
        aria-label={t("payWithApplePay")} onClick={() => onPay("APPLE_PAY")} />}
      {client && <fieldset disabled={disabled} className="min-w-0 disabled:opacity-50">
        <legend className="sr-only">{t("payWithGooglePay")}</legend>
        <div ref={googleHost} className="checkout-google-pay" />
      </fieldset>}
    </div>
  );
}
