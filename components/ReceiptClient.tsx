"use client";

import { useState } from "react";
import type { ReceiptData } from "@/services/api";
import type { CheckoutConfig, WebsiteConfig } from "@/lib/types";
import type { PageAppearanceOverrides } from "@/lib/websiteV3Api";
import { CustomerInfoCard } from "@/components/CustomerInfoCard";
import { PageAppearanceScope } from "@/components/PageAppearanceScope";
import { RestaurantThemeProvider } from "@/lib/restaurant-theme";
import { useResolvedTheme } from "@/lib/themes/useResolvedTheme";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/constants";
import { receiptGroups, receiptCopy, receiptStatusKey } from "@/lib/receipt";
import {
  DocumentTextIcon,
  PrinterIcon,
  ShareIcon,
} from "@heroicons/react/24/outline";
import Image from "next/image";
import Link from "next/link";

type Props = {
  receipt: ReceiptData;
  checkoutConfig?: CheckoutConfig | null;
  websiteConfig?: WebsiteConfig | null;
  appearance?: PageAppearanceOverrides | null;
  currency?: string;
  timezone?: string;
  menuHref?: string;
  historyHref?: string;
  preview?: boolean;
};

/** Renders the receipt with the restaurant's published commerce theme. */
export function ReceiptClient(props: Props) {
  const { direction } = useI18n();
  const inherited = useResolvedTheme();
  return (
    <RestaurantThemeProvider
      config={props.websiteConfig ?? inherited.config}
      direction={direction}
      pageMode="commerce"
    >
      <ReceiptContent {...props} />
    </RestaurantThemeProvider>
  );
}

function ReceiptContent({
  receipt,
  checkoutConfig,
  appearance,
  currency,
  timezone,
  menuHref,
  historyHref,
  preview = false,
}: Props) {
  const { t, locale, direction } = useI18n();
  const { config: siteConfig, resolved } = useResolvedTheme();
  const [shareMessage, setShareMessage] = useState("");
  const [shareError, setShareError] = useState(false);
  const [sharing, setSharing] = useState(false);
  const { order, restaurant } = receipt;
  const config = checkoutConfig?.receipt ?? {};
  const money = (amount: number) => formatMoney(amount, currency);
  const title = receiptCopy(config.title, locale, t("receiptTitle"));
  const message = receiptCopy(
    config.message,
    locale,
    t("receiptThanks").replace("{name}", restaurant.name),
  );
  const formattedDate = new Date(order.created_at).toLocaleString(
    { fr: "fr-FR", en: "en-US", he: "he-IL" }[locale],
    {
      dateStyle: "medium",
      timeStyle: "short",
      ...(timezone ? { timeZone: timezone } : {}),
    },
  );
  const orderTypeLabel = {
    dine_in: t("dineIn"),
    pickup: t("pickup"),
    delivery: t("delivery"),
  }[order.order_type];
  const groups = receiptGroups(receipt);

  async function shareReceipt() {
    if (preview) return;
    setSharing(true);
    setShareMessage("");
    setShareError(false);
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${title} #${order.id}`,
          text: restaurant.name,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setShareMessage(t("receiptLinkCopied"));
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setShareError(true);
      setShareMessage(t("receiptShareError"));
    } finally {
      setSharing(false);
    }
  }

  return (
    <PageAppearanceScope
      surface="checkout"
      commerceScreen="receipt"
      appearance={appearance}
      palette={{
        ...resolved?.theme.tokens.colors,
        ...siteConfig?.customPalette,
      }}
    >
      <main
        className="commerce-surface receipt-surface min-h-screen bg-[var(--bg-page)]"
        dir={direction}
        data-layout={config.layout ?? "comfortable"}
      >
        <div className="receipt-container">
          <header className="receipt-brand">
            {config.show_logo !== false && restaurant.logo_url && (
              <Image
                src={restaurant.logo_url}
                alt=""
                width={80}
                height={80}
                className="receipt-logo"
              />
            )}
            <div className="min-w-0">
              <p className="receipt-restaurant">{restaurant.name}</p>
              {config.show_address !== false && restaurant.address && (
                <p className="commerce-muted mt-1 text-sm break-words">
                  {restaurant.address}
                </p>
              )}
              {config.show_phone !== false && restaurant.phone && (
                <a
                  className="commerce-muted mt-1 inline-block text-sm"
                  href={`tel:${restaurant.phone.replace(/[^+\d]/g, "")}`}
                >
                  <bdi>{restaurant.phone}</bdi>
                </a>
              )}
            </div>
            <DocumentTextIcon
              className="receipt-document-icon"
              aria-hidden="true"
            />
          </header>

          <section className="receipt-intro" aria-labelledby="receipt-title">
            <h1 id="receipt-title" dir="auto">
              {title} <bdi>#{order.id}</bdi>
            </h1>
            <p dir="auto" className="commerce-muted mt-3 whitespace-pre-line">
              {message}
            </p>
            {config.show_status !== false && (
              <div className="receipt-statuses">
                <span className="receipt-status">
                  {t(receiptStatusKey(order.order_status, order.order_type))}
                </span>
                <span
                  className="receipt-status"
                  data-payment={order.payment_status}
                >
                  {t(receiptStatusKey(order.payment_status, "payment"))}
                </span>
              </div>
            )}
          </section>

          <dl className="receipt-details">
            <div>
              <dt>{t("date")}</dt>
              <dd>
                <time dateTime={order.created_at}>{formattedDate}</time>
              </dd>
            </div>
            <div>
              <dt>{t("type")}</dt>
              <dd>{orderTypeLabel}</dd>
            </div>
            {order.table_code && (
              <div>
                <dt>{t("table")}</dt>
                <dd>
                  <bdi>{order.table_code}</bdi>
                </dd>
              </div>
            )}
            {config.show_customer_info !== false && order.customer_name && (
              <div>
                <dt>{t("name")}</dt>
                <dd>{order.customer_name}</dd>
              </div>
            )}
          </dl>

          <div className="receipt-columns">
            <section
              className="receipt-order"
              aria-labelledby="receipt-items-title"
            >
              <h2 id="receipt-items-title" className="receipt-section-title">
                {t("yourOrder")}
              </h2>
              <ul className="receipt-items">
                {groups.map((group) => (
                  <li key={group.key} className="receipt-item">
                    {group.combo ? (
                      <>
                        <div className="receipt-item-heading">
                          <p className="font-semibold">
                            {group.items[0].combo_name || t("receiptCombo")}
                          </p>
                          <bdi className="receipt-price">
                            {money(group.total)}
                          </bdi>
                        </div>
                        {group.items[0].adjustment_kind === "comp" && (
                          <p className="commerce-muted mt-1 text-sm">
                            {t("itemComped")}
                          </p>
                        )}
                        <ul className="receipt-combo-items">
                          {group.items.map((item) => (
                            <li key={item.id}>
                              <ReceiptItemDetails
                                item={item}
                                currency={currency}
                                combo
                              />
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <ReceiptItemDetails
                        item={group.items[0]}
                        currency={currency}
                      />
                    )}
                  </li>
                ))}
              </ul>
              {config.show_customer_info !== false && (
                <div className="receipt-customer-info">
                  <CustomerInfoCard
                    customFields={order.custom_fields}
                    checkoutConfig={checkoutConfig}
                    showHint={false}
                  />
                </div>
              )}
            </section>

            <aside className="receipt-summary" aria-label={t("receiptSummary")}>
              <div className="receipt-total">
                <h2>{t("total")}</h2>
                <bdi>{money(order.total_amount)}</bdi>
              </div>
              <div className="receipt-actions" data-print-hidden>
                {config.show_print !== false && (
                  <button
                    type="button"
                    className="commerce-primary gap-2"
                    onClick={() => {
                      if (!preview) window.print();
                    }}
                  >
                    <PrinterIcon className="h-5 w-5" aria-hidden="true" />
                    {t("print")}
                  </button>
                )}
                {config.show_share !== false && (
                  <button
                    type="button"
                    className="commerce-secondary gap-2"
                    disabled={sharing}
                    onClick={shareReceipt}
                  >
                    <ShareIcon className="h-5 w-5" aria-hidden="true" />
                    {t("share")}
                  </button>
                )}
                {shareMessage && (
                  <p role={shareError ? "alert" : "status"} className="text-sm">
                    {shareMessage}
                  </p>
                )}
                {config.show_new_order !== false && (
                  <Link
                    className="receipt-link"
                    href={menuHref || `/r/${restaurant.id}/order`}
                  >
                    {t("backToMenu")}
                  </Link>
                )}
                {config.show_order_history !== false &&
                  siteConfig?.showOrdersLink !== false && (
                    <Link
                      className="receipt-link commerce-muted"
                      href={historyHref || `/r/${restaurant.id}/orders`}
                    >
                      {t("orderHistory")}
                    </Link>
                  )}
              </div>
            </aside>
          </div>
        </div>
      </main>
    </PageAppearanceScope>
  );
}

function ReceiptItemDetails({
  item,
  currency,
  combo = false,
}: {
  item: ReceiptData["items"][number];
  currency?: string;
  combo?: boolean;
}) {
  const { t } = useI18n();
  const money = (amount: number) => formatMoney(amount, currency);
  return (
    <>
      <div className="receipt-item-heading">
        <div className="receipt-item-name">
          <span className="receipt-quantity">
            <bdi>{item.quantity}×</bdi>
          </span>
          <div className="min-w-0">
            <p className={combo ? "text-sm" : "font-medium"}>{item.name}</p>
            {item.selected_variant_name && (
              <p className="commerce-muted mt-1 text-sm">
                {item.selected_variant_name}
              </p>
            )}
          </div>
        </div>
        {(!combo || item.total > 0) && (
          <div className="receipt-price">
            <bdi>
              {combo ? "+" : ""}
              {money(item.total)}
            </bdi>
            {!combo && item.quantity > 1 && (
              <p className="commerce-muted mt-1 text-xs">
                <bdi>{money(item.unit_price)}</bdi> {t("each")}
              </p>
            )}
          </div>
        )}
      </div>
      {!combo && item.adjustment_kind === "comp" && (
        <p className="commerce-muted mt-1 text-sm">{t("itemComped")}</p>
      )}
      {!!item.modifiers?.length && (
        <ul className="receipt-modifiers">
          {item.modifiers.map((mod, index) => (
            <li key={index}>
              {mod.action === "add" ? "+" : "−"} {mod.name}
              {item.adjustment_kind !== "comp" && mod.price_delta !== 0 && (
                <>
                  {" "}
                  (
                  <bdi>
                    {mod.price_delta > 0 ? "+" : ""}
                    {money(mod.price_delta)}
                  </bdi>
                  )
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {item.notes && (
        <p className="commerce-muted mt-2 text-sm whitespace-pre-line break-words">
          {item.notes}
        </p>
      )}
    </>
  );
}

/** Localized recovery screen for missing or temporarily unavailable receipts. */
export function ReceiptUnavailable() {
  const { t, direction } = useI18n();
  return (
    <main
      dir={direction}
      className="commerce-surface min-h-screen bg-[var(--bg-page)] flex items-center justify-center p-6"
    >
      <div className="max-w-md space-y-5 text-center">
        <DocumentTextIcon className="mx-auto h-10 w-10" aria-hidden="true" />
        <h1 className="text-2xl font-semibold">
          {t("receiptUnavailableTitle")}
        </h1>
        <p className="commerce-muted leading-7">
          {t("receiptUnavailableMessage")}
        </p>
        <button
          className="commerce-primary"
          onClick={() => window.location.reload()}
        >
          {t("receiptRetry")}
        </button>
      </div>
    </main>
  );
}
