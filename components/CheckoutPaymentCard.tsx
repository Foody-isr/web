"use client";

import { useId, type ReactNode } from "react";
import { CreditCardIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { useI18n } from "@/lib/i18n";
import type { SavedPaymentMethod } from "@/services/api";
import { CardholderIdentityField } from "@/components/CardholderIdentityField";

type Props = {
  methods: SavedPaymentMethod[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  canSave: boolean;
  saveCard: boolean;
  onSaveCardChange: (save: boolean) => void;
  onRemove: (id: number) => void;
  removing: boolean;
  removalError: boolean;
  disabled: boolean;
  identityRequired: boolean;
  identity: string;
  onIdentityChange: (value: string) => void;
  hostedSignup: boolean;
  children?: ReactNode;
};

/** A compact card selector; new card details stay on the hosted provider page. */
export function CheckoutPaymentCard(props: Props) {
  const { t } = useI18n();
  const groupId = useId();
  const { methods, selectedId, disabled, removing, canSave, identityRequired } =
    props;
  const blocked = disabled || removing;
  const brandLabel = (brand?: string) =>
    ({ VISA: "Visa", MASTERCARD: "Mastercard", AMEX: "American Express" })[
      brand?.toUpperCase() ?? ""
    ] ||
    brand ||
    t("creditCard");
  return (
    <div className="space-y-6" data-checkout-payment-card>
      <fieldset
        disabled={blocked}
        aria-labelledby={`${groupId}-title`}
        className="min-w-0 rounded-2xl border-2 border-[var(--checkout-heading,var(--text))] bg-[var(--surface)] text-[var(--text)]"
      >
        <legend className="sr-only">{t("savedCardsTitle")}</legend>
        <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
          <p
            id={`${groupId}-title`}
            className="font-semibold text-[var(--checkout-heading,var(--text))]"
          >
            {t("savedCardsTitle")}
          </p>
          <CreditCardIcon className="h-6 w-6 shrink-0" aria-hidden="true" />
        </div>
        <div className="space-y-2 px-3 pb-5 sm:px-4 sm:pb-6">
          {methods.map((method) => {
            const selected = selectedId === method.id;
            const radioId = `${groupId}-${method.id}`;
            return (
              <div
                key={method.id}
                className={`rounded-xl border ${selected ? "border-[var(--checkout-heading,var(--text))] bg-[var(--surface-subtle)]" : "border-[var(--divider)]"}`}
              >
                <div className="flex items-center gap-1 pe-2">
                  <label
                    htmlFor={radioId}
                    className={`flex min-w-0 flex-1 items-center gap-3 p-3 sm:p-4 ${!canSave || method.expired || blocked ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                  >
                    <input
                      id={radioId}
                      type="radio"
                      name={groupId}
                      value={method.id}
                      checked={selected}
                      disabled={!canSave || method.expired || blocked}
                      onChange={() => props.onSelect(method.id)}
                      className="h-4 w-4 shrink-0 accent-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand)]"
                    />
                    <span
                      className="flex h-8 w-11 shrink-0 items-center justify-center rounded-md border border-[var(--divider)] bg-[var(--surface)]"
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
                    className="min-h-11 shrink-0 rounded-md px-2 text-xs text-[var(--text-muted)] underline underline-offset-4 hover:text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)] disabled:opacity-50"
                  >
                    {t("removeSavedCard")}
                  </button>
                </div>
                {selected && identityRequired && (
                  <div className="border-t border-[var(--divider)] p-4">
                    <CardholderIdentityField
                      key={method.id}
                      id="saved-card-identity"
                      value={props.identity}
                      onChange={props.onIdentityChange}
                      disabled={blocked}
                    />
                  </div>
                )}
              </div>
            );
          })}
          <label
            className={`flex items-start gap-3 rounded-xl border p-4 ${blocked ? "cursor-not-allowed" : "cursor-pointer"} ${selectedId === null ? "border-[var(--checkout-heading,var(--text))] bg-[var(--surface-subtle)]" : "border-[var(--divider)]"}`}
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
              <span className="block font-medium">{t("useNewCard")}</span>
              {selectedId === null && !props.children && (
                <span className="mt-1 block max-w-prose text-xs text-[var(--text-muted)]">
                  {t("hostedCardEntryHelp")}
                </span>
              )}
            </span>
          </label>
          {props.removalError && (
            <p role="alert" className="px-1 pt-2 text-sm text-red-600">
              {t("savedCardRemoveError")}
            </p>
          )}
          {selectedId === null && props.children}
        </div>
      </fieldset>
      {selectedId === null && canSave && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-[var(--checkout-heading,var(--text))]">
            {t("saveCardSectionTitle")}
          </p>
          <label
            className={`flex items-start gap-3 rounded-xl bg-[var(--surface-subtle)] p-4 sm:p-5 ${blocked ? "cursor-not-allowed" : "cursor-pointer"}`}
          >
            <input
              type="checkbox"
              checked={props.saveCard}
              disabled={blocked}
              onChange={(event) => props.onSaveCardChange(event.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand)]"
            />
            <span className="min-w-0 space-y-2 text-sm leading-relaxed text-[var(--text)]">
              <span className="block font-medium">{t("saveCardForLater")}</span>
              <span className="block max-w-prose text-xs text-[var(--text-muted)]">
                {t("savedCardSecurityNote")}
              </span>
              {props.saveCard && props.hostedSignup && (
                <span className="block max-w-prose text-xs text-[var(--text-muted)]">
                  {t("hostedSignupConsentHelp")}
                </span>
              )}
            </span>
          </label>
        </div>
      )}
      <p className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <LockClosedIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {t("paymentSecureNote")}
      </p>
    </div>
  );
}
