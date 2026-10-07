"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import type { CartLine } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { useMenuLanguage } from "@/lib/menu-language";
import { tField } from "@/lib/translations";
import { formatMoney } from "@/lib/constants";
import {
  formatModifierLabel,
  formatSelectedVariantName,
  lineTotal,
  lineUnitPrice,
} from "@/lib/cart";
import { useCartStore } from "@/store/useCartStore";
import { cartItemQuantityLimit } from "@/lib/cart-availability";

/** Shared item presentation and store actions for the website cart surfaces. */
export function CommerceCartItems({
  lines,
  currency,
  compact = false,
  editable = true,
  onEdit,
  notice,
}: {
  lines: CartLine[];
  currency: string;
  compact?: boolean;
  editable?: boolean;
  onEdit?: (line: CartLine) => void;
  notice?: (line: CartLine) => ReactNode;
}) {
  const { t } = useI18n();
  const { menuLocale } = useMenuLanguage();
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  return (
    <ul className="commerce-items" data-compact={compact}>
      {lines.map((line) => {
        const name = line.comboName || tField(line.item, "name", menuLocale);
        return (
          <li key={line.id} className="commerce-item">
            <div className="commerce-item-image">
              {line.item.imageUrl && (
                <Image
                  src={line.item.imageUrl}
                  alt={name}
                  width={104}
                  height={104}
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                {onEdit && !line.comboId ? (
                  <button
                    type="button"
                    className="text-start font-semibold break-words hover:underline"
                    onClick={() => onEdit(line)}
                    aria-label={`${t("edit")} · ${name}`}
                  >
                    {name}
                  </button>
                ) : (
                  <p className="font-semibold break-words">{name}</p>
                )}
                <p className="shrink-0 tabular-nums">
                  {formatMoney(lineTotal(line), currency)}
                </p>
              </div>
              {line.selectedVariantName && (
                <p className="commerce-muted mt-2 text-sm">
                  {formatSelectedVariantName(line, menuLocale)}
                </p>
              )}
              {!compact && (
                <p className="commerce-muted mt-2 text-sm">
                  {formatMoney(lineUnitPrice(line), currency)}
                </p>
              )}
              {line.modifiers?.map((modifier) => (
                <p key={modifier.id} className="commerce-muted mt-2 text-sm">
                  {formatModifierLabel(modifier, menuLocale)}
                </p>
              ))}
              {line.comboSelections?.map((selection, index) => (
                <p key={index} className="commerce-muted mt-2 text-sm">
                  {selection.quantity > 1 ? `${selection.quantity} × ` : ""}
                  {selection.menuItemName}
                </p>
              ))}
              {line.note && (
                <p className="commerce-muted mt-2 text-sm">{line.note}</p>
              )}
              {notice?.(line)}
              {editable ? (
                <div className="mt-4 flex items-center justify-between gap-4">
                  {line.comboId ? (
                    <span className="text-sm">× {line.quantity}</span>
                  ) : (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="commerce-quantity"
                        disabled={line.quantity <= 1}
                        aria-label={`${t("decreaseQuantity")} · ${name}`}
                        onClick={() =>
                          updateQuantity(line.id, line.quantity - 1)
                        }
                      >
                        −
                      </button>
                      <span
                        className="min-w-5 text-center tabular-nums"
                        aria-live="polite"
                      >
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        className="commerce-quantity"
                        disabled={line.quantity >= cartItemQuantityLimit(line.item, lines, line.id)}
                        aria-label={`${t("increaseQuantity")} · ${name}`}
                        onClick={() =>
                          updateQuantity(line.id, line.quantity + 1)
                        }
                      >
                        +
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    className="commerce-remove"
                    aria-label={`${t("remove")} · ${name}`}
                    onClick={() => removeItem(line.id)}
                  >
                    <svg
                      aria-hidden="true"
                      width="20"
                      height="20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"
                      />
                    </svg>
                  </button>
                </div>
              ) : (
                <p className="commerce-muted mt-2 text-sm">× {line.quantity}</p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
