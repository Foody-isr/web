"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useIsMobileViewport } from "@/lib/themes/useViewMode";
import type { WebsiteCartInteraction } from "@/hooks/useWebsiteCart";
import { websiteCartPosition } from "@/lib/websiteCart";
import type { CartLine } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/constants";
import { lineTotal } from "@/lib/cart";
import { CommerceCartItems } from "./CommerceCartItems";

/** Anchored, nonmodal desktop mini-cart and focus-managed mobile cart dialog. */
export function WebsiteCartPopover({
  interaction,
  open,
  onClose,
  lines,
  currency,
  onContinue,
  disabled,
  leadSummary,
  minimumRemaining,
}: {
  interaction?: WebsiteCartInteraction;
  open: boolean;
  onClose: () => void;
  lines: CartLine[];
  currency: string;
  onContinue: () => void;
  disabled: boolean;
  leadSummary?: { headline: string; detail?: string };
  minimumRemaining: number;
}) {
  const { t, direction } = useI18n();
  const ownDialog = useRef<HTMLDialogElement>(null);
  const dialog = interaction?.panelRef ?? ownDialog;
  const anchor = interaction?.triggerRef;
  const isMobile = useIsMobileViewport();
  const [position, setPosition] = useState<CSSProperties>();
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    const updatePosition = () => {
      const rect = anchor?.current?.getBoundingClientRect();
      if (!rect) {
        setPosition(undefined);
        return;
      }
      setPosition(
        websiteCartPosition(
          rect,
          { width: window.innerWidth, height: window.innerHeight },
          direction === "rtl",
        ),
      );
    };
    const outside = (event: globalThis.PointerEvent) => {
      if (
        !element.contains(event.target as Node) &&
        !anchor?.current?.contains(event.target as Node)
      )
        close.current();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current();
    };
    if (isMobile) {
      document.body.style.overflow = "hidden";
      element.showModal();
    } else {
      // Setting open directly avoids taking keyboard focus when the mouse enters.
      element.open = true;
      updatePosition();
      document.addEventListener("pointerdown", outside);
      document.addEventListener("keydown", escape);
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
    }
    return () => {
      const restoreFocus = isMobile || element.contains(document.activeElement);
      element.close();
      if (isMobile) document.body.style.overflow = overflow;
      if (restoreFocus) previous?.focus({ preventScroll: true });
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, isMobile, anchor, dialog, direction]);
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = lines.reduce((sum, line) => sum + lineTotal(line), 0);
  return (
    <dialog
      ref={dialog}
      className="commerce-surface commerce-popover"
      style={isMobile ? undefined : position}
      dir={direction}
      aria-labelledby="website-cart-title"
      onPointerEnter={interaction?.cancelClose}
      onPointerLeave={interaction?.scheduleClose}
      onBlurCapture={interaction?.scheduleClose}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-4 p-6">
          <h2 id="website-cart-title" className="text-2xl">
            {t("yourCart")} ({count})
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="commerce-quantity"
            aria-label={t("close")}
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6">
          {lines.length ? (
            <CommerceCartItems lines={lines} currency={currency} compact />
          ) : (
            <p className="commerce-muted py-12 text-center">{t("emptyCart")}</p>
          )}
        </div>
        <div className="space-y-4 p-6">
          {leadSummary && (
            <p className="text-sm leading-relaxed">
              {leadSummary.headline}
              {leadSummary.detail && (
                <span className="commerce-muted block">
                  {leadSummary.detail}
                </span>
              )}
            </p>
          )}
          {minimumRemaining > 0 && (
            <p role="status" className="text-sm">
              {t("minimumOrderRemaining").replace(
                "{amount}",
                formatMoney(minimumRemaining, currency),
              )}
            </p>
          )}
          <button
            type="button"
            className="commerce-primary"
            disabled={disabled}
            onClick={onContinue}
          >
            {t("continueToCart")} {formatMoney(total, currency)}
          </button>
          {!lines.length && (
            <button
              type="button"
              className="commerce-secondary"
              onClick={onClose}
            >
              {t("continueShopping")}
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
