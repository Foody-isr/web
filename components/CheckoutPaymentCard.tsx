"use client";

import { useId, type ReactNode } from "react";
import { ChevronDownIcon, CreditCardIcon, LockClosedIcon } from "@heroicons/react/24/outline";
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
  integrated?: boolean;
  cardEntryOpen?: boolean;
  onToggleCardEntry?: () => void;
  accountSection?: ReactNode;
  preferencesSection?: ReactNode;
};

/**
 * Selects a saved card or reveals new-card entry alongside supported wallets.
 */
export function CheckoutPaymentCard(props: Props) {
  const { t } = useI18n();
  const groupId = useId();
  const { methods, selectedId, disabled, removing, canSave } = props;
  const blocked = disabled || removing;
  const cardDisclosure = props.integrated && methods.length === 0 && props.onToggleCardEntry;
  const brandLabel = (brand?: string) =>
    ({ VISA: "Visa", MASTERCARD: "Mastercard", AMEX: "American Express" })[
      brand?.toUpperCase() ?? ""
    ] ||
    brand ||
    t("creditCard");
  return (
    <div className="space-y-5" data-checkout-payment-card>
      {props.wallets}
      <fieldset
        disabled={blocked}
        aria-labelledby={`${groupId}-title`}
        className="min-w-0 rounded-[16px] border border-[var(--divider)] bg-[var(--surface)] text-[var(--text)]"
      >
        <legend className="sr-only">{t("savedCardsTitle")}</legend>
        {cardDisclosure ? (
          <button
            type="button"
            className="flex min-h-14 w-full items-center gap-3 rounded-[16px] px-5 py-4 text-start font-semibold text-[var(--checkout-heading,var(--text))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)] sm:px-6"
            aria-expanded={props.cardEntryOpen}
            aria-controls={`${groupId}-card-entry`}
            onClick={props.onToggleCardEntry}
          >
            <CreditCardIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span id={`${groupId}-title`} className="flex-1">{t("savedCardsTitle")}</span>
            <ChevronDownIcon className={`h-4 w-4 shrink-0 ${props.cardEntryOpen ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
        ) : (
          <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
            <p id={`${groupId}-title`} className="font-semibold text-[var(--checkout-heading,var(--text))]">
              {t("savedCardsTitle")}
            </p>
            <CreditCardIcon className="h-6 w-6 shrink-0" aria-hidden="true" />
          </div>
        )}
        {cardDisclosure ? (
          <div id={`${groupId}-card-entry`} hidden={!props.children} className="mx-5 border-t border-[var(--divider)] pb-5 pt-4 sm:mx-6 sm:pb-6">
            {props.children}
          </div>
        ) : <div className="space-y-2 px-3 pb-5 sm:px-4 sm:pb-6">
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
          {selectedId === null && props.children && (
            <div id={`${groupId}-card-entry`} className="border-t border-[var(--divider)] px-2 pt-4">
              {props.children}
            </div>
          )}
        </div>}
      </fieldset>
      {props.accountSection}
      {props.preferencesSection}
      <p className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <LockClosedIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {t("paymentSecureNote")}
      </p>
    </div>
  );
}
