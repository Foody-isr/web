"use client";

import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import { QuestionMarkCircleIcon } from "@heroicons/react/24/outline";
import { useI18n } from "@/lib/i18n";
import { encryptVerifoneCard, formatVerifoneCardExpiry, formatVerifoneCardNumber, invalidCardCaptureField } from "@/lib/verifone-card-capture";
import { fetchCardCaptureKey, type EncryptedCardPayment } from "@/services/api";

export type VerifoneCardCaptureHandle = {
  prepare(): Promise<EncryptedCardPayment>;
};

/** Signals that the form already identifies and explains the invalid field. */
export class VerifoneCardInputError extends Error {}

const copy = {
  fr: {
    title: "Carte de test Verifone",
    number: "Numéro de carte",
    expiry: "Date d’expiration",
    placeholder: "MM/AA",
    cvv: "Code de sécurité",
    cvvHelp: "Les 3 chiffres au dos de la carte ou les 4 chiffres au recto d’une American Express.",
    identity: "N° d’identité du titulaire",
    identityHelp: "9 chiffres",
    errors: { cardNumber: "Vérifiez le numéro de carte.", expiry: "Saisissez une date d’expiration valide.", cvv: "Saisissez les 3 ou 4 chiffres du code.", identity: "Saisissez les 9 chiffres du numéro d’identité." },
    encryption: "Le chiffrement est indisponible. Réessayez dans un instant.",
  },
  en: {
    title: "Verifone test card",
    number: "Card number",
    expiry: "Expiry date",
    placeholder: "MM/YY",
    cvv: "Security code",
    cvvHelp: "The 3 digits on the back of your card or 4 on the front of an American Express.",
    identity: "Cardholder ID number",
    identityHelp: "9 digits",
    errors: { cardNumber: "Check the card number.", expiry: "Enter a valid expiry date.", cvv: "Enter the 3 or 4 digit code.", identity: "Enter the 9 digit ID number." },
    encryption: "Card encryption is unavailable. Try again in a moment.",
  },
  he: {
    title: "כרטיס בדיקה של Verifone",
    number: "מספר כרטיס",
    expiry: "תוקף הכרטיס",
    placeholder: "MM/YY",
    cvv: "קוד אבטחה",
    cvvHelp: "3 הספרות בגב הכרטיס או 4 הספרות בחזית כרטיס אמריקן אקספרס.",
    identity: "מספר תעודת זהות של בעל הכרטיס",
    identityHelp: "9 ספרות",
    errors: { cardNumber: "בחרו מספר כרטיס תקין.", expiry: "הזינו תאריך תפוגה תקין.", cvv: "הזינו קוד של 3 או 4 ספרות.", identity: "הזינו מספר תעודת זהות בן 9 ספרות." },
    encryption: "הצפנת הכרטיס אינה זמינה. נסו שוב בעוד רגע.",
  },
};

type Field = keyof typeof copy.en.errors;

/** Captures card data in uncontrolled fields and clears it before submitting. */
export const VerifoneCardCapture = forwardRef<VerifoneCardCaptureHandle, { restaurantId: string; disabled: boolean }>(
  function VerifoneCardCapture({ restaurantId, disabled }, ref) {
    const { locale } = useI18n();
    const text = copy[locale];
    const id = useId();
    const fieldset = useRef<HTMLFieldSetElement>(null);
    const [invalid, setInvalid] = useState<Field | null>(null);
    const element = (name: Field) => fieldset.current?.querySelector<HTMLInputElement>(`[data-card-field="${name}"]`);
    const clear = (group: HTMLFieldSetElement | null) => group?.querySelectorAll("input").forEach((field) => { field.value = ""; });
    useEffect(() => {
      const group = fieldset.current;
      return () => clear(group);
    }, []);
    useEffect(() => {
      if (!disabled && invalid) element(invalid)?.focus();
    }, [disabled, invalid]);
    useImperativeHandle(ref, () => ({
      prepare: async () => {
        const [expiryMonth = "", expiryYear = ""] = (element("expiry")?.value ?? "").split("/");
        const input = {
          cardNumber: element("cardNumber")?.value ?? "",
          expiryMonth,
          expiryYear: expiryYear.length === 2 ? `20${expiryYear}` : "",
          cvv: element("cvv")?.value ?? "",
          identity: element("identity")?.value ?? "",
        };
        const invalidField = invalidCardCaptureField(input);
        setInvalid(invalidField);
        if (invalidField) throw new VerifoneCardInputError(text.errors[invalidField]);
        clear(fieldset.current);
        try {
          return await encryptVerifoneCard(input, await fetchCardCaptureKey(restaurantId));
        } catch {
          throw new Error(text.encryption);
        } finally {
          input.cardNumber = input.cvv = input.identity = "";
        }
      },
    }));

    const field = (name: Field, placeholder: string, maxLength: number, format?: (value: string) => string, secret = false) => (
      <>
        <input id={`${id}-${name}`} data-card-field={name} type={secret ? "password" : "text"} inputMode="numeric" autoComplete="off"
          maxLength={maxLength} dir="ltr" spellCheck={false} placeholder={placeholder}
          aria-invalid={invalid === name} aria-describedby={invalid === name ? `${id}-error` : name === "identity" ? `${id}-identity-help` : undefined}
          onChange={(event) => {
            const input = event.currentTarget;
            const value = input.value;
            let offset = value.slice(0, input.selectionStart ?? value.length).replace(/\D/g, "").length;
            input.value = format ? format(value) : value.replace(/\D/g, "").slice(0, maxLength);
            if (!secret && value !== input.value) {
              let cursor = 0;
              while (cursor < input.value.length && offset > 0) {
                if (/\d/.test(input.value[cursor])) offset--;
                cursor++;
              }
              input.setSelectionRange(cursor, cursor);
            }
            if (invalid === name) setInvalid(null);
          }}
          className="commerce-contact-control tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)]"
        />
        {invalid === name && <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-[var(--error)]">{text.errors[name]}</p>}
      </>
    );

    return (
      <fieldset ref={fieldset} disabled={disabled} data-sentry-block className="min-w-0 space-y-4">
        <legend className="mb-3 text-xs font-medium text-[var(--text-muted)]">{text.title}</legend>
        <div>
          <label htmlFor={`${id}-cardNumber`} className="mb-1.5 block text-sm font-medium">{text.number}</label>
          {field("cardNumber", "0000 0000 0000 0000", 23, formatVerifoneCardNumber)}
        </div>
        <div className="grid min-w-0 grid-cols-2 items-start gap-3">
          <div>
            <label htmlFor={`${id}-expiry`} className="mb-1.5 flex min-h-7 items-center text-sm font-medium">{text.expiry}</label>
            {field("expiry", text.placeholder, 5, formatVerifoneCardExpiry)}
          </div>
          <div>
            <div className="mb-1.5 flex min-h-7 items-center justify-between gap-1">
              <label htmlFor={`${id}-cvv`} className="text-sm font-medium">{text.cvv}</label>
              <details className="relative shrink-0">
                <summary className="grid h-7 w-7 cursor-pointer list-none place-items-center rounded-full text-[var(--text-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)] [&::-webkit-details-marker]:hidden">
                  <QuestionMarkCircleIcon className="h-5 w-5" aria-hidden="true" /><span className="sr-only">{text.cvv}</span>
                </summary>
                <p className="absolute end-0 top-full z-10 mt-1 w-48 rounded-[10px] border border-[var(--divider)] bg-[var(--surface)] p-3 text-xs leading-relaxed shadow-lg">{text.cvvHelp}</p>
              </details>
            </div>
            {field("cvv", "CVV", 4, undefined, true)}
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-2">
            <label htmlFor={`${id}-identity`} className="text-sm font-medium">{text.identity}</label>
            <span id={`${id}-identity-help`} className="text-xs text-[var(--text-muted)]">{text.identityHelp}</span>
          </div>
          {field("identity", "", 9, undefined, true)}
        </div>
      </fieldset>
    );
  },
);
