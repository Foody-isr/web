"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CheckoutFlow } from "@/app/order/checkout/CheckoutFlow";
import { useI18n } from "@/lib/i18n";

/** Accessible cart review over the preserved menu, with native history support. */
export function CartOverlay() {
  const router = useRouter();
  const { t, direction } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const closing = useRef(false);
  const close = () => {
    if (closing.current) return;
    closing.current = true;
    router.back();
  };

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    const gutter = document.documentElement.style.scrollbarGutter;
    document.documentElement.style.scrollbarGutter = "stable";
    document.body.style.overflow = "hidden";
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      document.documentElement.style.scrollbarGutter = gutter;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className="commerce-surface commerce-cart-overlay"
      dir={direction}
      aria-label={t("yourCart")}
      onCancel={(event) => {
        // React propagates cancel from nested fulfillment dialogs as well.
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right ||
            event.clientY < rect.top || event.clientY > rect.bottom) close();
      }}
    >
      <CheckoutFlow reviewCart onContinueShopping={close} />
    </dialog>
  );
}
