"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

type Locale = "en" | "he";

const translations: Record<Locale, Record<string, string>> = {
  en: {
    all: "All",
    menu: "Menu",
    addToCart: "Add to cart",
    cart: "Cart",
    notes: "Notes",
    modifiers: "Modifiers",
    payNow: "Pay now",
    payLater: "Pay at counter",
    splitPayment: "Split payment",
    placeOrder: "Place order",
    orderSummary: "Order summary",
    emptyCart: "Your cart is empty",
    statusTimeline: "Order status",
    changeLanguage: "Change language",
    // Order types
    dineIn: "Dine In",
    pickup: "Pickup",
    delivery: "Delivery",
    pickupDescription: "Order now, pick up at the restaurant",
    deliveryDescription: "We'll bring your order to you",
    howWouldYouLikeToOrder: "How would you like to order?",
    noOrderOptionsAvailable: "Online ordering is not available at this time.",
    // Customer form
    deliveryDetails: "Delivery Details",
    pickupDetails: "Pickup Details",
    name: "Name",
    phone: "Phone",
    yourName: "Your name",
    yourPhone: "Your phone number",
    deliveryAddress: "Delivery Address",
    fullAddress: "Full delivery address",
    deliveryNotes: "Delivery Notes",
    deliveryNotesPlaceholder: "Floor, apartment, etc.",
    cancel: "Cancel",
    continue: "Continue"
  },
  he: {
    all: "הכל",
    menu: "תפריט",
    addToCart: "הוסף להזמנה",
    cart: "עגלת קניות",
    notes: "הערות",
    modifiers: "שינויים",
    payNow: "תשלום עכשיו",
    payLater: "תשלום בקופה",
    splitPayment: "פיצול תשלום",
    placeOrder: "בצע הזמנה",
    orderSummary: "סיכום הזמנה",
    emptyCart: "העגלה ריקה",
    statusTimeline: "סטטוס הזמנה",
    changeLanguage: "שנה שפה",
    // Order types
    dineIn: "אכילה במקום",
    pickup: "איסוף עצמי",
    delivery: "משלוח",
    pickupDescription: "הזמן עכשיו, אסוף מהמסעדה",
    deliveryDescription: "נביא את ההזמנה אליך",
    howWouldYouLikeToOrder: "איך תרצה להזמין?",
    noOrderOptionsAvailable: "הזמנות אונליין אינן זמינות כרגע.",
    // Customer form
    deliveryDetails: "פרטי משלוח",
    pickupDetails: "פרטי איסוף",
    name: "שם",
    phone: "טלפון",
    yourName: "השם שלך",
    yourPhone: "מספר הטלפון שלך",
    deliveryAddress: "כתובת למשלוח",
    fullAddress: "כתובת מלאה למשלוח",
    deliveryNotes: "הערות למשלוח",
    deliveryNotesPlaceholder: "קומה, דירה, וכו'",
    cancel: "ביטול",
    continue: "המשך"
  }
};

type LocaleContextValue = {
  locale: Locale;
  direction: "ltr" | "rtl";
  t: (key: string) => string;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export const LocaleProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocale] = useState<Locale>("en");
  const direction = locale === "he" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
  }, [locale, direction]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      direction,
      t: (key: string) => translations[locale][key] ?? key,
      setLocale
    }),
    [locale, direction]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

export const useI18n = () => {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useI18n must be used within LocaleProvider");
  return ctx;
};
