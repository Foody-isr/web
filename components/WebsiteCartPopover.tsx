"use client";

import { useEffect, useRef } from "react";
import type { CartLine } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/constants";
import { lineTotal } from "@/lib/cart";
import { CommerceCartItems } from "./CommerceCartItems";

/** Responsive website mini-cart with native dialog focus and Escape handling. */
export function WebsiteCartPopover({
  open,
  onClose,
  lines,
  currency,
  onContinue,
  disabled,
  leadSummary,
  minimumRemaining,
}: {
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
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      previous?.focus({ preventScroll: true });
    };
  }, [open]);
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = lines.reduce((sum, line) => sum + lineTotal(line), 0);
  return (
    <dialog
      ref={dialog}
      className="commerce-surface commerce-popover"
      dir={direction}
      aria-labelledby="website-cart-title"
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
            autoFocus
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
