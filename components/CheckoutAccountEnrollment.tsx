"use client";

import { BoltIcon } from "@heroicons/react/24/outline";
import { CustomerSignIn } from "@/components/CustomerSignIn";
import { useI18n } from "@/lib/i18n";

/** Creates a verified customer identity without losing the guest's checkout fields. */
export function CheckoutAccountEnrollment({ email, name, onSignedIn }: {
  email: string;
  name: string;
  onSignedIn: () => void;
}) {
  const { t } = useI18n();
  return <section aria-label={t("checkoutAccountCreate")} data-checkout-account className="border-t border-[var(--divider)] pt-6">
    <div className="mb-5 flex items-start gap-3">
      <BoltIcon aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-[var(--checkout-heading,var(--text))]" />
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-[var(--checkout-heading,var(--text))]">{t("checkoutAccountCreate")}</h2>
        <p className="mt-1 text-sm font-medium text-[var(--text)]">{t("checkoutAccountBenefit")}</p>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-[var(--text-muted)]">{t("checkoutAccountHelp")}</p>
      </div>
    </div>
    <CustomerSignIn variant="enrollment" initialEmail={email} initialName={name} onSignedIn={onSignedIn} />
  </section>;
}
