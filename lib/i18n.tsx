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
    continue: "Continue",
    // Checkout & OTP
    checkout: "Checkout",
    reviewOrder: "Review Your Order",
    verifyPhone: "Verify Your Phone",
    verifyPhoneDescription: "We'll send you a verification code to confirm your order",
    sendCode: "Send Code",
    resendCode: "Resend Code",
    verifyCode: "Verify",
    enterCode: "Enter verification code",
    codeSent: "Code sent to",
    codeExpires: "Code expires in",
    invalidCode: "Invalid or expired code",
    tooManyAttempts: "Too many attempts, please request a new code",
    phoneRequired: "Phone number is required",
    confirmOrder: "Confirm Order",
    total: "Total",
    items: "items",
    editOrder: "Edit Order",
    orderConfirmed: "Order Confirmed!",
    preparingOrder: "We're preparing your order",
    estimatedTime: "Estimated time",
    minutes: "minutes",
    trackOrder: "Track Order",
    back: "Back",
    step: "Step",
    of: "of",
    // Payment
    paymentSuccess: "Payment Successful",
    paymentFailed: "Payment Failed",
    paymentSuccessMessage: "Your order has been confirmed",
    paymentFailedMessage: "We couldn't process your payment. Please try again.",
    tryAgain: "Try Again",
    cancelOrder: "Cancel Order",
    cancelOrderConfirm: "Cancel Order?",
    cancelOrderConfirmMessage: "Are you sure you want to cancel this order? This action cannot be undone.",
    goBack: "Go Back",
    returnToMenu: "Return to Menu",
    orderBeingPrepared: "Your order is being prepared...",
    trackOrderStatus: "Track Order Status",
    amount: "Amount",
    reason: "Reason",
    needHelp: "Need help? Contact the restaurant staff for assistance.",
    redirectingToPayment: "Redirecting to payment...",
    orderNotFound: "Order Not Found",
    unableToLoadOrder: "Unable to load order details",
    invalidOrderId: "Invalid order ID or restaurant ID",
    subtotal: "Subtotal",
    vat: "VAT",
    // Receipt & Order History
    order: "Order",
    date: "Date",
    type: "Type",
    table: "Table",
    print: "Print",
    share: "Share",
    home: "Home",
    orderHistory: "Order History",
    yourOrders: "Your Orders",
    viewPastOrders: "View Your Orders",
    enterPhoneToViewOrders: "Enter your phone number to view your order history",
    noOrdersFound: "No orders found for this phone number"
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
    continue: "המשך",
    // Checkout & OTP
    checkout: "תשלום",
    reviewOrder: "סקירת ההזמנה",
    verifyPhone: "אימות טלפון",
    verifyPhoneDescription: "נשלח לך קוד אימות לאישור ההזמנה",
    sendCode: "שלח קוד",
    resendCode: "שלח שוב",
    verifyCode: "אמת",
    enterCode: "הזן קוד אימות",
    codeSent: "קוד נשלח ל",
    codeExpires: "הקוד יפוג בעוד",
    invalidCode: "קוד שגוי או פג תוקף",
    tooManyAttempts: "יותר מדי ניסיונות, בקש קוד חדש",
    phoneRequired: "מספר טלפון נדרש",
    confirmOrder: "אשר הזמנה",
    total: "סה״כ",
    items: "פריטים",
    editOrder: "ערוך הזמנה",
    orderConfirmed: "ההזמנה אושרה!",
    preparingOrder: "אנחנו מכינים את ההזמנה שלך",
    estimatedTime: "זמן משוער",
    minutes: "דקות",
    trackOrder: "עקוב אחרי ההזמנה",
    back: "חזור",
    step: "שלב",
    of: "מתוך",
    // Payment
    paymentSuccess: "התשלום בוצע בהצלחה",
    paymentFailed: "התשלום נכשל",
    paymentSuccessMessage: "ההזמנה שלך אושרה",
    paymentFailedMessage: "לא הצלחנו לעבד את התשלום. אנא נסה שוב.",
    tryAgain: "נסה שוב",
    cancelOrder: "ביטול הזמנה",
    cancelOrderConfirm: "ביטול הזמנה?",
    cancelOrderConfirmMessage: "האם אתה בטוח שברצונך לבטל את ההזמנה? פעולה זו אינה ניתנת לביטול.",
    goBack: "חזור",
    returnToMenu: "חזרה לתפריט",
    orderBeingPrepared: "ההזמנה שלך בהכנה...",
    trackOrderStatus: "מעקב אחר סטטוס ההזמנה",
    amount: "סכום",
    reason: "סיבה",
    needHelp: "צריך עזרה? צור קשר עם צוות המסעדה לסיוע.",
    redirectingToPayment: "מעביר לעמוד תשלום...",
    orderNotFound: "ההזמנה לא נמצאה",
    unableToLoadOrder: "לא ניתן לטעון את פרטי ההזמנה",
    invalidOrderId: "מספר הזמנה או מסעדה לא חוקי",
    subtotal: "סכום ביניים",
    vat: "מע״מ",
    // Receipt & Order History
    order: "הזמנה",
    date: "תאריך",
    type: "סוג",
    table: "שולחן",
    print: "הדפס",
    share: "שתף",
    home: "בית",
    orderHistory: "היסטוריית הזמנות",
    yourOrders: "ההזמנות שלך",
    viewPastOrders: "צפה בהזמנות שלך",
    enterPhoneToViewOrders: "הזן את מספר הטלפון שלך כדי לצפות בהיסטוריית ההזמנות",
    noOrdersFound: "לא נמצאו הזמנות עבור מספר טלפון זה"
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
