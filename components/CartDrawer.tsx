"use client";

import { useCartStore } from "@/store/useCartStore";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { useMenuLanguage } from "@/lib/menu-language";
import { tField } from "@/lib/translations";
import { formatModifierLabel, lineTotal, lineUnitPrice } from "@/lib/cart";
import { useHydrated } from "@/hooks/useHydrated";
import { VAT_MULTIPLIER, CURRENCY_SYMBOL, currencySymbol } from "@/lib/constants";
import type { CSSVariableStyle } from "@/lib/websiteV3Appearance";
import Image from "next/image";

/**
 * Every colour the drawer paints resolves through one of these tokens, declared
 * once on the drawer root. The builder writes the `--cart-*` variables (see
 * `pageAppearanceVariables`); each falls back to the value the drawer used
 * before it was configurable, so an untouched restaurant renders identically.
 *
 * The indirection exists because the same override feeds several elements at
 * different tints — `accent` paints the stepper signs, the combo badge and the
 * tip box — and inlining `var(--cart-x, var(--y))` at every call site made those
 * relationships impossible to see or keep consistent.
 */
const CART_TOKENS: CSSVariableStyle = {
  "--ct-surface": "var(--cart-surface, var(--bg-page))",
  "--ct-surface-muted": "var(--cart-surface-muted, var(--surface-subtle))",
  "--ct-divider": "var(--cart-divider, var(--divider))",
  "--ct-accent": "var(--cart-accent, rgb(var(--brand-rgb, 235 82 4)))",
  "--ct-heading": "var(--cart-heading, var(--text-primary))",
  "--ct-text": "var(--cart-text, var(--text))",
  "--ct-muted": "var(--cart-muted, var(--text-muted))",
  "--ct-soft": "var(--cart-muted, var(--text-soft))",
  "--ct-price": "var(--cart-price, var(--brand))",
  // The CTA follows the cart accent unless given its own fill. Hover keeps that
  // fill rather than jumping to the theme's brand-dark, which would discard the
  // owner's colour on the one interaction that draws the most attention.
  "--ct-button-bg":
    "var(--cart-button-bg, var(--cart-accent, rgb(var(--brand-rgb, 235 82 4))))",
  "--ct-button-bg-hover":
    "var(--cart-button-bg, var(--cart-accent, var(--brand-dark, #C94400)))",
  "--ct-button-text": "var(--cart-button-text, #fff)",
  "--ct-close-bg": "var(--cart-close-bg, var(--ct-surface-muted))",
  "--ct-close-bg-hover": "var(--cart-close-bg, var(--ct-divider))",
  "--ct-close-text": "var(--cart-close-text, var(--ct-heading))",
  "--ct-stepper-bg": "var(--cart-stepper-bg, transparent)",
  "--ct-stepper-bg-hover": "var(--cart-stepper-bg, var(--ct-surface-muted))",
  "--ct-stepper-text": "var(--cart-stepper-text, var(--ct-accent))",
  "--ct-stepper-border": "var(--cart-stepper-border, var(--ct-divider))",
  "--ct-remove": "var(--cart-remove, #ef4444)",
};

type Props = {
  open: boolean;
  onClose: () => void;
  currency: string;
  onCheckout: () => void;
  onSplitPayment?: () => void;
  /** When set, the CTA becomes a direct confirm button instead of "Go to checkout" */
  confirmLabel?: string;
  onConfirmOrder?: () => void;
  isSubmitting?: boolean;
  /** When true, the drawer renders a "Sent to kitchen" success state instead
   *  of the cart contents. Used briefly after a dine-in confirm so the
   *  cart-empties moment feels like a handoff, not a disappearance. */
  successState?: boolean;
  /** Minimum order amount for delivery (0 = no minimum) */
  minimumOrderDelivery?: number;
  /** Current order type — used to enforce minimum order for delivery */
  orderType?: string;
  /** Future-week preview (view-only): disables checkout so no order is placed. */
  previewMode?: boolean;
};

export function CartDrawer({ open, onClose, currency, onCheckout, onSplitPayment, confirmLabel, onConfirmOrder, isSubmitting, successState, minimumOrderDelivery = 0, orderType, previewMode = false }: Props) {
  const { lines, updateQuantity, removeItem, total } = useCartStore();
  const { t, direction } = useI18n();
  const { menuLocale } = useMenuLanguage();
  const hydrated = useHydrated();
  const totalAmount = useMemo(() => total(), [total, lines]);
  const totalItems = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity, 0),
    [lines]
  );
  const displayLines = hydrated ? lines : [];
  const displayTotalAmount = hydrated ? totalAmount : 0;
  const displayTotalItems = hydrated ? totalItems : 0;
  const isBelowMinimum = orderType === "delivery" && minimumOrderDelivery > 0 && displayTotalAmount < minimumOrderDelivery;
  const remaining = minimumOrderDelivery - displayTotalAmount;
  // Dine-in pay-at-end has its own flavor: a "Step 1 · To send" tagline at
  // the top, a tip box, and a "not yet paid — settle at the end" footnote.
  // Signalled by the parent providing `onConfirmOrder` (set only when
  // `isDineInNoPrepay` is true in OrderExperience).
  const isDineInContext = !!onConfirmOrder;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop. Kept at 60% even when coloured: a picker returns an
              opaque hex, and a solid backdrop would read as a page swap rather
              than an overlay. Resolved inline because the backdrop is a sibling
              of the drawer and so cannot inherit CART_TOKENS. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[color-mix(in_srgb,var(--cart-overlay,#000)_60%,transparent)] z-40"
            onClick={onClose}
          />
          
          {/* Cart modal — bottom-sheet that slides up on mobile, stays
              full-bleed on desktop too. The customer is focused on this
              modal; constraining width on desktop adds complexity without
              real benefit for the QR-ordering flow. */}
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-50 bg-[var(--ct-surface)] flex flex-col"
            style={CART_TOKENS}
            dir={direction}
          >
            {successState ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex-1 flex flex-col items-center justify-center px-6 text-center"
              >
                <motion.div
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", damping: 14, stiffness: 240 }}
                  className="w-24 h-24 rounded-full bg-[color-mix(in_srgb,var(--ct-accent)_15%,transparent)] flex items-center justify-center mb-6"
                >
                  <span className="text-5xl">🍳</span>
                </motion.div>
                <h2 className="text-2xl font-bold text-[var(--ct-text)] mb-2">
                  {t("sentToKitchen") || "Sent to kitchen"}
                </h2>
                <p className="text-[var(--ct-soft)] max-w-xs">
                  {t("sentToKitchenDesc") || "Added to your table — keep ordering"}
                </p>
              </motion.div>
            ) : (
              <>
                {/* Header: title (with optional dine-in step tagline) + close */}
                <div className="flex-shrink-0 flex items-start justify-between gap-4 px-5 pt-4 pb-3">
                  <div className="min-w-0">
                    {isDineInContext && (
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--ct-soft)]">
                        {t("cartStepOne") || "Step 1 · To send"}
                      </p>
                    )}
                    <h1 className="text-[26px] sm:text-[28px] font-extrabold leading-tight tracking-tight text-[var(--ct-heading)] mt-1">
                      {t("yourOrder") || "Your order"}
                    </h1>
                  </div>
                  <button
                    onClick={onClose}
                    aria-label={t("close") || "Close"}
                    className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--ct-close-bg)] flex items-center justify-center text-[var(--ct-close-text)] hover:bg-[var(--ct-close-bg-hover)] active:scale-[0.96] transition"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-4">
              {displayLines.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-20 h-20 mx-auto rounded-full bg-[var(--ct-surface-muted)] flex items-center justify-center mb-4">
                    <svg className="w-10 h-10 text-[var(--ct-soft)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  </div>
                  <p className="text-[var(--ct-muted)] text-lg">{t("emptyCart")}</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {/* Cart Items */}
                  {displayLines.map((line) => (
                    <div 
                      key={line.id} 
                      className="flex items-center gap-4 py-4 border-b border-[var(--ct-divider)]"
                    >
                      {/* Item Image */}
                      <div className="w-16 h-16 rounded-xl bg-[var(--ct-surface-muted)] overflow-hidden flex-shrink-0">
                        {line.comboId ? (
                          /* Combo icon placeholder */
                          <div
                            className="w-full h-full flex items-center justify-center"
                            style={{
                              background:
                                "linear-gradient(to bottom right, color-mix(in srgb, var(--ct-accent) 20%, transparent), color-mix(in srgb, var(--ct-accent) 5%, transparent))",
                            }}
                          >
                            <svg className="w-8 h-8 text-[var(--ct-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                          </div>
                        ) : line.item.imageUrl ? (
                          <Image
                            src={line.item.imageUrl}
                            alt={tField(line.item, "name", menuLocale)}
                            width={64}
                            height={64}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[var(--ct-soft)]">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Item Details */}
                      <div className="flex-1 min-w-0">
                        {line.comboId ? (
                          <>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-[var(--ct-text)]">{line.comboName || tField(line.item, "name", menuLocale)}</p>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] text-[var(--ct-accent)] uppercase">Combo</span>
                              {line.comboOrderBatch && line.comboOrderBatch.length > 1 && (
                                <span className="text-[11px] font-bold text-[var(--ct-accent)] tabular-nums">×{line.comboOrderBatch.length}</span>
                              )}
                            </div>
                            <p className="text-[var(--ct-price)] font-semibold mt-0.5">
                              {currencySymbol(currency)}{lineUnitPrice(line).toFixed(2)}
                            </p>
                            {/* Show selected items per step */}
                            {line.comboSelections && line.comboSelections.length > 0 && (
                              <div className="mt-1.5 space-y-0.5">
                                {line.comboSelections.map((sel, idx) => (
                                  <p key={idx} className="text-[11px] text-[var(--ct-muted)]">
                                    {sel.quantity > 1 ? `${sel.quantity}× ` : ""}{sel.menuItemName}
                                    {sel.priceDelta > 0 && (
                                      <span className="text-[var(--ct-price)] ms-1">(+{currencySymbol(currency)}{sel.priceDelta.toFixed(2)})</span>
                                    )}
                                  </p>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <p className="font-semibold text-[var(--ct-text)]">
                              {tField(line.item, "name", menuLocale)}{(() => {
                                if (!line.selectedVariantName) return '';
                                // Look up the variant on the stored item to localize
                                // the snapshot label if the customer switches locale.
                                for (const os of line.item.optionSets ?? []) {
                                  const opt = os.options.find((o) => o.id === line.selectedVariantId);
                                  if (opt) return ` - ${tField(opt, "name", menuLocale, line.selectedVariantName)}`;
                                }
                                return ` - ${line.selectedVariantName}`;
                              })()}
                            </p>
                            <p className="text-[var(--ct-price)] font-semibold mt-0.5">
                              {currencySymbol(currency)}{lineUnitPrice(line).toFixed(2)}
                            </p>
                            {line.modifiers && line.modifiers.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {line.modifiers.map((modifier) => (
                                  <span
                                    key={modifier.id}
                                    className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--ct-surface-muted)] text-[var(--ct-muted)]"
                                  >
                                    {formatModifierLabel(modifier, menuLocale)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                        {line.note && (
                          <p className="text-xs text-[var(--ct-muted)] mt-1 italic">&quot;{line.note}&quot;</p>
                        )}
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex-shrink-0">
                        {line.comboId ? (
                          /* Combo lines: remove button only (quantity is always 1) */
                          <button
                            className="w-9 h-9 flex items-center justify-center text-[var(--ct-remove)] hover:bg-[color-mix(in_srgb,var(--ct-remove)_10%,transparent)] rounded-lg transition"
                            onClick={() => removeItem(line.id)}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        ) : (
                          <div className="flex items-center gap-0 border border-[var(--ct-stepper-border)] rounded-lg overflow-hidden">
                            <button
                              className="w-9 h-9 flex items-center justify-center bg-[var(--ct-stepper-bg)] text-[var(--ct-stepper-text)] hover:bg-[var(--ct-stepper-bg-hover)] transition"
                              onClick={() => updateQuantity(line.id, Math.max(0, line.quantity - 1))}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                              </svg>
                            </button>
                            <span className="min-w-[32px] text-center font-semibold text-[var(--ct-text)]">
                              {line.quantity}
                            </span>
                            <button
                              className="w-9 h-9 flex items-center justify-center bg-[var(--ct-stepper-bg)] text-[var(--ct-stepper-text)] hover:bg-[var(--ct-stepper-bg-hover)] transition"
                              onClick={() => updateQuantity(line.id, line.quantity + 1)}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Astuce tip box — only shown in dine-in pay-at-end mode.
                  Reinforces "send now, add more later, pay once at the end". */}
              {isDineInContext && displayLines.length > 0 && (
                <div className="mt-4 mb-3 flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] text-[12.5px] leading-relaxed text-[var(--ct-heading)]">
                  <span className="text-base leading-none flex-shrink-0">💡</span>
                  <div>
                    <b className="font-extrabold">{t("tipPrefix") || "Tip:"}</b>{" "}
                    {t("cartTipDineIn") ||
                      "send this batch to the kitchen now — you can add more later without re-paying."}
                  </div>
                </div>
              )}
            </div>

            {/* Footer with Checkout Button */}
            {displayLines.length > 0 && (
              <div className="flex-shrink-0 p-4 space-y-3">
                {/* Minimum order warning for delivery */}
                {isBelowMinimum && (
                  <div className="flex items-center gap-3 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3">
                    <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.832c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-amber-400">
                        {t("minimumOrderNotMet")} {CURRENCY_SYMBOL}{minimumOrderDelivery}
                      </p>
                      <p className="text-xs text-amber-400/70 mt-0.5">
                        {t("addMoreToReachMinimum")} ({CURRENCY_SYMBOL}{remaining.toFixed(2)})
                      </p>
                    </div>
                  </div>
                )}

                {/* Primary CTA — rounded-full pill matching the dock */}
                <button
                  className="w-full py-4 px-5 rounded-full font-extrabold text-[15px] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 bg-[var(--ct-button-bg)] text-[var(--ct-button-text)] hover:bg-[var(--ct-button-bg-hover)] active:scale-[0.99]"
                  style={{
                    boxShadow:
                      "0 10px 24px -6px color-mix(in srgb, var(--ct-button-bg) 50%, transparent)",
                  }}
                  onClick={onConfirmOrder || onCheckout}
                  disabled={displayLines.length === 0 || isSubmitting || isBelowMinimum || previewMode}
                >
                  {/* Count chip tints itself from the button's own text colour
                      so it still reads on a light owner-picked fill. */}
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[color-mix(in_srgb,var(--ct-button-text)_22%,transparent)] text-[13px] font-extrabold flex items-center justify-center">
                    {isSubmitting ? (
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      displayTotalItems
                    )}
                  </span>
                  <span className="flex-1 text-start truncate">
                    {previewMode
                      ? t("previewOrderingDisabled") || "Preview — ordering disabled"
                      : confirmLabel || t("goToCheckout") || "Go to checkout"}
                  </span>
                  <span className="tabular-nums flex-shrink-0">
                    {currencySymbol(currency)}
                    {displayTotalAmount.toFixed(2)}
                  </span>
                </button>

                {/* Service fee footnote */}
                <p className="text-center text-[11px] text-[var(--ct-soft)]">
                  {t("estimatedServiceFee") || "Estimated service fee"}{" "}
                  <span className="tabular-nums">{currencySymbol(currency)}1.00</span>
                  {isDineInContext && (
                    <>
                      {" · "}
                      <span className="font-bold">
                        {t("notYetPaid") || "Not yet paid"}
                      </span>{" "}
                      — {t("settleAtEnd") || "settle at the end"}
                    </>
                  )}
                </p>
              </div>
            )}
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
