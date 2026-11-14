"use client";

import { useId, type ReactNode } from "react";
import { CreditCardIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { useI18n } from "@/lib/i18n";
import type { SavedPaymentMethod } from "@/services/api";

type Props = {
  methods: SavedPaymentMethod[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  canSave: boolean;
  onRemove: (id: number) => void;
  removing: boolean;
  removalError: boolean;
  disabled: boolean;
  children?: ReactNode;
  wallets?: ReactNode;
  saveConsent?: { checked: boolean; onChange: (checked: boolean) => void; hosted: boolean; disabled: boolean };
};

/**
 * Shows available wallets, saved cards and the inline form for a new card.
 */
export function CheckoutPaymentCard(props: Props) {
  const { t } = useI18n();
  const groupId = useId();
  const { methods, selectedId, disabled, removing, canSave, saveConsent } = props;
  const blocked = disabled || removing;
  const hostedSignup = saveConsent?.checked && saveConsent.hosted;
  const brandLabel = (brand?: string) =>
    ({ VISA: "Visa", MASTERCARD: "Mastercard", AMEX: "American Express" })[
      brand?.toUpperCase() ?? ""
    ] ||
    brand ||
    t("creditCard");
  return (
    <div className="space-y-5" data-checkout-payment-card>
      {props.wallets}
      {methods.length > 0 && <fieldset disabled={blocked} className="min-w-0 space-y-2">
        <legend className="sr-only">{t("savedCardsTitle")}</legend>
          {methods.map((method) => {
            const selected = selectedId === method.id;
            const radioId = `${groupId}-${method.id}`;
            return (
              <div
                key={method.id}
                className={`rounded-[10px] border ${selected ? "border-[var(--checkout-heading,var(--text))] bg-[var(--surface-subtle)]" : "border-[var(--divider)]"}`}
              >
                <div className="flex items-center gap-1 pe-2">
                  <label
                    htmlFor={radioId}
                    className={`flex min-w-0 flex-1 items-center gap-3 p-3 sm:p-4 ${!canSave || method.expired || method.available === false || blocked ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                  >
                    <input
                      id={radioId}
                      type="radio"
                      name={groupId}
                      value={method.id}
                      checked={selected}
                      disabled={!canSave || method.expired || method.available === false || blocked}
                      onChange={() => props.onSelect(method.id)}
                      className="h-4 w-4 shrink-0 accent-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand)]"
                    />
                    <span
                      className="flex h-8 w-11 shrink-0 items-center justify-center rounded-[4px] border border-[var(--divider)] bg-[var(--surface)]"
                      aria-hidden="true"
                    >
                      <CreditCardIcon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 text-sm leading-5">
                      <span className="flex flex-wrap items-baseline gap-x-2 font-medium">
                        <span>{brandLabel(method.card_brand)}</span>
                        <bdi className="tabular-nums" dir="ltr">
                          •••• {method.card_last_four || "----"}
                        </bdi>
                      </span>
                      {method.expiry_month && method.expiry_year ? (
                        <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                          {t("savedCardExpiry")}{" "}
                          <bdi dir="ltr" className="tabular-nums">
                            {String(method.expiry_month).padStart(2, "0")}/
                            {String(method.expiry_year).slice(-2)}
                          </bdi>
                        </span>
                      ) : null}
                      {method.expired && (
                        <span className="mt-1 block text-xs text-red-600">
                          {t("savedCardExpired")}
                        </span>
                      )}
                    </span>
                  </label>
                  <button
                    type="button"
                    disabled={blocked}
                    onClick={() => props.onRemove(method.id)}
                    aria-label={`${t("removeSavedCard")} ${brandLabel(method.card_brand)} ${method.card_last_four || ""}`}
                    className="min-h-11 shrink-0 rounded-[4px] px-2 text-xs text-[var(--text-muted)] underline underline-offset-4 hover:text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)] disabled:opacity-50"
                  >
                    {t("removeSavedCard")}
                  </button>
                </div>
              </div>
            );
          })}
          <label
            className={`flex items-start gap-3 rounded-[10px] border p-4 ${blocked ? "cursor-not-allowed" : "cursor-pointer"} ${selectedId === null ? "border-[var(--checkout-heading,var(--text))] bg-[var(--surface-subtle)]" : "border-[var(--divider)]"}`}
          >
            <input
              type="radio"
              name={groupId}
              value="new"
              checked={selectedId === null}
              onChange={() => props.onSelect(null)}
              className="mt-1 h-4 w-4 shrink-0 accent-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand)]"
            />
            <span className="min-w-0 text-sm leading-relaxed">
              {t("useNewCard")}
            </span>
          </label>
          {props.removalError && (
            <p role="alert" className="px-1 pt-2 text-sm text-red-600">
              {t("savedCardRemoveError")}
            </p>
          )}
      </fieldset>}
      {selectedId === null && <>
        {props.children ?? (!hostedSignup && (
          <p className="max-w-prose text-sm text-[var(--text-muted)]">{t("hostedCardEntryHelp")}</p>
        ))}
        {saveConsent && (
          <div className="space-y-1.5">
            <label className={`flex items-start gap-3 py-2 text-sm leading-relaxed ${blocked || saveConsent.disabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
              <CreditCardIcon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span id={`${groupId}-save-label`} className="block font-medium">{t("saveCardForLater")}</span>
                <span id={`${groupId}-save-help`} className="mt-0.5 block text-xs text-[var(--text-muted)]">
                  {t(saveConsent.hosted ? "hostedSaveCardHelp" : "savedCardSecurityNote")}
                </span>
              </span>
              <input
                type="checkbox"
                data-save-card
                checked={saveConsent.checked}
                disabled={blocked || saveConsent.disabled}
                onChange={event => saveConsent.onChange(event.target.checked)}
                aria-labelledby={`${groupId}-save-label`}
                aria-describedby={`${groupId}-save-help${hostedSignup ? ` ${groupId}-hosted-signup` : ""}`}
                className="h-5 w-5 shrink-0 self-center accent-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand)]"
              />
            </label>
            <div aria-live="polite">
              {hostedSignup && (
                <p id={`${groupId}-hosted-signup`} role="note" className="max-w-prose ps-8 text-xs text-[var(--text-muted)]">
                  {t("hostedSignupConsentHelp")}
                </p>
              )}
            </div>
          </div>
        )}
      </>}
      <p className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <LockClosedIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {t("paymentSecureNote")}
      </p>
    </div>
  );
}
