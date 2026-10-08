"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import {
  encryptVerifoneCard,
  validCardCapture,
  type CardCaptureInput,
} from "@/lib/verifone-card-capture";
import { fetchCardCaptureKey, type EncryptedCardPayment } from "@/services/api";

export type VerifoneCardCaptureHandle = {
  prepare: () => Promise<EncryptedCardPayment>;
};

const copy = {
  fr: {
    title: "Carte de test · Sandbox",
    note: "Carte de test uniquement. Les données sont chiffrées dans votre navigateur avant leur envoi. Aucun abonnement ni débit automatique.",
    name: "Titulaire",
    number: "Numéro de carte",
    month: "Mois (MM)",
    year: "Année (AAAA)",
    cvv: "CVV",
    identity: "Identité du titulaire (9 chiffres)",
    invalid:
      "Vérifiez les informations de la carte de test. Aucun paiement tenté.",
    encryption: "Chiffrement indisponible. Aucun paiement tenté.",
  },
  en: {
    title: "Test card · Sandbox",
    note: "Test cards only. Details are encrypted in your browser before sending. No subscription or automatic charges.",
    name: "Cardholder",
    number: "Card number",
    month: "Month (MM)",
    year: "Year (YYYY)",
    cvv: "CVV",
    identity: "Cardholder identity (9 digits)",
    invalid: "Check the test card details. No payment attempted.",
    encryption: "Encryption unavailable. No payment attempted.",
  },
  he: {
    title: "כרטיס בדיקה · Sandbox",
    note: "כרטיסי בדיקה בלבד. הפרטים מוצפנים בדפדפן לפני השליחה. ללא מנוי או חיוב אוטומטי.",
    name: "שם בעל הכרטיס",
    number: "מספר כרטיס",
    month: "חודש (MM)",
    year: "שנה (YYYY)",
    cvv: "CVV",
    identity: "תעודת זהות של בעל הכרטיס (9 ספרות)",
    invalid: "יש לבדוק את פרטי כרטיס הבדיקה. לא בוצע חיוב.",
    encryption: "ההצפנה אינה זמינה. לא בוצע חיוב.",
  },
};

/** Uncontrolled, ephemeral inputs: no card data in application state or storage. */
export const VerifoneCardCapture = forwardRef<
  VerifoneCardCaptureHandle,
  { restaurantId: string; disabled: boolean }
>(function VerifoneCardCapture({ restaurantId, disabled }, ref) {
  const { locale } = useI18n();
  const text = copy[locale as keyof typeof copy] ?? copy.en;
  const fieldset = useRef<HTMLFieldSetElement>(null);
  const read = (): CardCaptureInput => {
    const value = (name: string) =>
      fieldset.current?.querySelector<HTMLInputElement>(
        `[data-card-field="${name}"]`,
      )?.value ?? "";
    return {
      cardNumber: value("cardNumber"),
      cardholderName: value("cardholderName"),
      expiryMonth: value("expiryMonth"),
      expiryYear: value("expiryYear"),
      cvv: value("cvv"),
      identity: value("identity"),
    };
  };
  const clear = () =>
    fieldset.current
      ?.querySelectorAll<HTMLInputElement>("input")
      .forEach((input) => {
        input.value = "";
      });
  useEffect(() => {
    const element = fieldset.current;
    return () =>
      element?.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
        input.value = "";
      });
  }, []);
  useImperativeHandle(ref, () => ({
    prepare: async () => {
      if (!validCardCapture(read())) throw new Error(text.invalid);
      try {
        const key = await fetchCardCaptureKey(restaurantId);
        return await encryptVerifoneCard(read(), key);
      } catch {
        throw new Error(text.encryption);
      } finally {
        clear();
      }
    },
  }));
  const field = (
    name: string,
    label: string,
    maxLength: number,
    numeric = true,
    secret = false,
  ) => (
    <label className="block text-sm text-[var(--text)]" key={name}>
      <span className="mb-1 block">{label}</span>
      <input
        data-card-field={name}
        type={secret ? "password" : "text"}
        inputMode={numeric ? "numeric" : "text"}
        autoComplete="off"
        maxLength={maxLength}
        dir={numeric ? "ltr" : undefined}
        spellCheck={false}
        className="w-full rounded-xl border border-[var(--divider)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)]"
      />
    </label>
  );
  return (
    <fieldset
      ref={fieldset}
      disabled={disabled}
      aria-describedby="verifone-capture-note"
      className="space-y-3 rounded-xl border border-[var(--divider)] p-4"
      dir={locale === "he" ? "rtl" : "ltr"}
    >
      <legend className="px-1 text-sm font-semibold text-[var(--text)]">
        {text.title}
      </legend>
      <p
        id="verifone-capture-note"
        className="text-xs text-[var(--text-muted)]"
      >
        {text.note}
      </p>
      {field("cardholderName", text.name, 100, false)}
      {field("cardNumber", text.number, 23)}
      <div className="grid grid-cols-3 gap-3">
        {field("expiryMonth", text.month, 2)}
        {field("expiryYear", text.year, 4)}
        {field("cvv", text.cvv, 4, true, true)}
      </div>
      {field("identity", text.identity, 9, true, true)}
    </fieldset>
  );
});
