"use client";

import { useEffect, useId, useRef, useState } from "react";
import { EnvelopeIcon, EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { CustomerSocialSignIn } from "@/components/CustomerSocialSignIn";
import { useI18n } from "@/lib/i18n";

/** Collects credentials inline; only the checkout's Pay action submits them. */
export function CheckoutAccountEnrollment({ email, password, enabled, onEmailChange, onPasswordChange, onEnabledChange, onSignedIn, disabled, error }: {
  email: string; password: string; enabled: boolean;
  onEmailChange: (email: string) => void; onPasswordChange: (password: string) => void;
  onEnabledChange: (enabled: boolean) => void; onSignedIn: () => void;
  disabled: boolean; error: string;
}) {
  const { t } = useI18n();
  const id = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const emailChoiceRef = useRef<HTMLButtonElement>(null);
  const emailWasOpen = useRef(enabled);
  const [showPassword, setShowPassword] = useState(false);
  const inputClass = "commerce-contact-control";
  useEffect(() => {
    if (enabled) emailRef.current?.focus();
    else if (emailWasOpen.current) emailChoiceRef.current?.focus();
    emailWasOpen.current = enabled;
  }, [enabled]);
  return <section aria-label={t("checkoutAccountCreate")} data-checkout-account className="space-y-5 border-t border-[var(--divider)] pt-6">
    <div>
      <h2 className="text-lg font-semibold text-[var(--checkout-heading,var(--text))]">{t("checkoutAccountCreate")}</h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{t("checkoutAccountBenefit")}</p>
    </div>
    <div className="w-full max-w-[400px] space-y-3">
      <div inert={disabled || undefined}><CustomerSocialSignIn onSignedIn={onSignedIn} useFoodyButtons /></div>
      {enabled ? <fieldset disabled={disabled} className="min-w-0 space-y-4">
        <div>
          <label htmlFor={`${id}-email`} className="mb-2 block text-sm font-medium">{t("email")}</label>
          <input id={`${id}-email`} ref={emailRef} form="checkout-details" name="checkout-account-email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={320} value={email} onChange={event => onEmailChange(event.target.value)} placeholder={t("accountEmailPlaceholder")} className={inputClass} />
        </div>
        <div>
          <label htmlFor={`${id}-password`} className="mb-2 block text-sm font-medium">{t("accountPassword")}</label>
          <div className="relative">
            <input id={`${id}-password`} form="checkout-details" name="checkout-account-password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={15} maxLength={128} required value={password} onChange={event => onPasswordChange(event.target.value)} aria-describedby={`${id}-password-help`} className={`${inputClass} !pe-12`} />
            <button type="button" aria-label={t(showPassword ? "accountHidePassword" : "accountShowPassword")} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} className="absolute inset-y-0 end-0 flex w-12 items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)]">{showPassword ? <EyeSlashIcon aria-hidden="true" className="h-5 w-5" /> : <EyeIcon aria-hidden="true" className="h-5 w-5" />}</button>
          </div>
          <p id={`${id}-password-help`} className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">{t("accountPasswordHint")}</p>
        </div>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">{t("checkoutAccountPayTogether")}</p>
        {error && <p role="alert" className="text-sm leading-relaxed">{error}</p>}
        <button type="button" className="text-sm text-[var(--text-muted)] underline underline-offset-4" onClick={() => onEnabledChange(false)}>{t("checkoutContinueGuest")}</button>
      </fieldset> : (
        <button
          ref={emailChoiceRef}
          type="button"
          disabled={disabled}
          aria-expanded={false}
          className="commerce-secondary customer-auth-choice"
          onClick={() => { setShowPassword(false); onEnabledChange(true); }}
        >
          <EnvelopeIcon aria-hidden="true" />
          <span>{t("accountContinueEmail")}</span>
        </button>
      )}
    </div>
  </section>;
}
