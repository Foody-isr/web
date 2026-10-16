"use client";

import { useLayoutEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CheckoutFlow } from "@/app/order/checkout/CheckoutFlow";
import { useI18n } from "@/lib/i18n";
import type { Restaurant } from "@/lib/types";

/** Accessible cart review over the preserved menu, with native history support. */
export function CartOverlay({ initialRestaurant, preserveMenu = false }: { initialRestaurant?: Restaurant; preserveMenu?: boolean }) {
  const router = useRouter();
  const { t, direction } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const closing = useRef(false);
  const close = () => {
    if (closing.current) return;
    closing.current = true;
    router.back();
  };
  const continueShopping = (href: string) => {
    if (preserveMenu) {
      close();
      return;
    }
    if (closing.current) return;
    closing.current = true;
    // Checkout and content pages are not shopping destinations. Replace the
    // cart entry with its menu instead of revealing the page behind it.
    router.replace(href);
  };

  useLayoutEffect(() => {
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
      // Layout cleanup runs before React removes the dialog. Restore focus
      // after that mutation, so Safari cannot return it to the removed control.
      queueMicrotask(() => {
        if (previous?.isConnected && !document.querySelector("dialog.commerce-cart-overlay[open]")) {
          previous.focus({ preventScroll: true });
        }
      });
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
      <CheckoutFlow reviewCart onContinueShopping={continueShopping} initialRestaurant={initialRestaurant} />
    </dialog>
  );
}
