"use client";

import { useI18n } from "@/lib/i18n";

/** Offers to remember changes to the customer's contact details. */
export function CheckoutPreferences({
  detailsChanged,
  updatingDetails,
  rememberDetails,
  onRememberDetailsChange,
  disabled,
}: {
  detailsChanged: boolean;
  updatingDetails: boolean;
  rememberDetails: boolean;
  onRememberDetailsChange: (remember: boolean) => void;
  disabled: boolean;
}) {
  const { t } = useI18n();
  if (!detailsChanged) return null;
  return (
    <section
      aria-label={t("saveCardSectionTitle")}
      data-checkout-preferences
      className="mt-5 space-y-3"
    >
      <h3 className="text-sm font-semibold text-[var(--checkout-heading,var(--text))]">
        {t("saveCardSectionTitle")}
      </h3>
      <label className={`flex items-start gap-3 rounded-[10px] bg-[var(--surface-subtle)] p-4 sm:p-5 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
        <input
          type="checkbox"
          data-remember-details
          checked={rememberDetails}
          disabled={disabled}
          onChange={(event) => onRememberDetailsChange(event.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand)]"
        />
        <span className="min-w-0 space-y-2 text-sm leading-relaxed text-[var(--text)]">
          <span className="block font-medium">
            {t(updatingDetails ? "updateCheckoutDetails" : "rememberCheckoutDetails")}
          </span>
          <span className="block max-w-prose text-xs text-[var(--text-muted)]">
            {t("checkoutDetailsChoiceHelp")}
          </span>
        </span>
      </label>
    </section>
  );
}
