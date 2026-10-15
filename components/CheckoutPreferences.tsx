"use client";

import { CheckIcon } from "@heroicons/react/24/outline";
import { useI18n } from "@/lib/i18n";

/** Groups future-order preferences while keeping profile updates and card saving independent. */
export function CheckoutPreferences({
  detailsChanged,
  detailsSaved,
  updatingDetails,
  rememberDetails,
  onRememberDetailsChange,
  canSaveCard,
  saveCard,
  onSaveCardChange,
  hostedSignup,
  disabled,
}: {
  detailsChanged: boolean;
  detailsSaved: boolean;
  updatingDetails: boolean;
  rememberDetails: boolean;
  onRememberDetailsChange: (remember: boolean) => void;
  canSaveCard: boolean;
  saveCard: boolean;
  onSaveCardChange: (save: boolean) => void;
  hostedSignup: boolean;
  disabled: boolean;
}) {
  const { t } = useI18n();
  if (!detailsChanged && !canSaveCard) return null;
  const checkboxClass =
    "mt-0.5 h-5 w-5 shrink-0 accent-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand)]";
  const rowClass = `flex items-start gap-3 p-4 sm:p-5 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`;
  return (
    <section
      aria-label={t("saveCardSectionTitle")}
      data-checkout-preferences
      className="space-y-3"
    >
      <h3 className="text-sm font-semibold text-[var(--checkout-heading,var(--text))]">
        {t("saveCardSectionTitle")}
      </h3>
      <div className="divide-y divide-[var(--divider)] rounded-[10px] bg-[var(--surface-subtle)]">
        {detailsChanged ? (
          <label className={rowClass}>
            <input
              type="checkbox"
              data-remember-details
              checked={rememberDetails}
              disabled={disabled}
              onChange={(event) =>
                onRememberDetailsChange(event.target.checked)
              }
              className={checkboxClass}
            />
            <span className="min-w-0 space-y-2 text-sm leading-relaxed text-[var(--text)]">
              <span className="block font-medium">
                {t(
                  updatingDetails
                    ? "updateCheckoutDetails"
                    : "rememberCheckoutDetails",
                )}
              </span>
              <span className="block max-w-prose text-xs text-[var(--text-muted)]">
                {t("checkoutDetailsChoiceHelp")}
              </span>
            </span>
          </label>
        ) : detailsSaved ? (
          <p
            role="status"
            className="flex items-start gap-3 p-4 text-sm leading-relaxed text-[var(--text-muted)] sm:p-5"
          >
            <CheckIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            {t("checkoutDetailsSaved")}
          </p>
        ) : null}
        {canSaveCard && (
          <label className={rowClass}>
            <input
              type="checkbox"
              data-save-card
              checked={saveCard}
              disabled={disabled}
              onChange={(event) => onSaveCardChange(event.target.checked)}
              className={checkboxClass}
            />
            <span className="min-w-0 space-y-2 text-sm leading-relaxed text-[var(--text)]">
              <span className="block font-medium">{t("saveCardForLater")}</span>
              <span className="block max-w-prose text-xs text-[var(--text-muted)]">
                {t("savedCardSecurityNote")}
              </span>
              {saveCard && hostedSignup && (
                <span
                  className="block max-w-prose space-y-2 text-xs text-[var(--text-muted)]"
                  role="note"
                >
                  <span className="block">{t("hostedSignupConsentHelp")}</span>
                  <span className="block">{t("hostedSignupBeforeReturn")}</span>
                </span>
              )}
            </span>
          </label>
        )}
      </div>
    </section>
  );
}
