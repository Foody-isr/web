"use client";

import { Restaurant, OrderType, BatchFulfillmentConfigResponse, OrderPageBarItem } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { ensureFont } from "@/components/sections/typography";
import { currencySymbol } from "@/lib/constants";
import { WifiSheet } from "@/components/WifiSheet";
import { useRestaurantTheme } from "@/lib/restaurant-theme";
import { barItemsForMode, modalSectionsFor } from "@/lib/orderPageInfo";
import Image from "next/image";
import { useEffect, useState } from "react";

/* ── Social bar items: link normalization + minimal monochrome icons ── */
type SocialPlatform = "instagram" | "whatsapp" | "facebook" | "tiktok";

function socialHref(p: SocialPlatform, v: string): string {
  if (/^https?:\/\//i.test(v)) return v;
  switch (p) {
    case "instagram":
      return `https://instagram.com/${v.replace(/^@/, "")}`;
    case "whatsapp":
      return `https://wa.me/${v.replace(/[^\d]/g, "")}`;
    case "facebook":
      return `https://facebook.com/${v}`;
    case "tiktok":
      return `https://tiktok.com/@${v.replace(/^@/, "")}`;
  }
}

const SOCIAL_ICON: Record<SocialPlatform, React.ReactNode> = {
  instagram: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  ),
  whatsapp: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.1-1.3A10 10 0 1 0 12 2Zm5.2 13.8c-.2.6-1.2 1.2-1.7 1.2-.4 0-1 .2-3.4-.9-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8 0-1.3.7-2 .9-2.2.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.5c-.2.2-.3.4-.1.7.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.2.1.4.1.6-.1l.7-.9c.2-.2.4-.2.6-.1l1.9.9c.2.1.4.2.4.3.1.2.1.7-.1 1.3Z" />
    </svg>
  ),
  facebook: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.2c-1.2 0-1.6.8-1.6 1.5V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z" />
    </svg>
  ),
  tiktok: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.5 3c.3 2 1.5 3.5 3.5 3.7v2.5c-1.2.1-2.4-.3-3.5-1v6.6a5.8 5.8 0 1 1-5.8-5.8c.3 0 .6 0 .9.1v2.6a3.2 3.2 0 1 0 2.3 3V3h2.6Z" />
    </svg>
  ),
};

function clampPercent(v: number | undefined): number {
  if (typeof v !== "number" || Number.isNaN(v)) return 50;
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
}

type Props = {
  restaurant: Restaurant;
  orderType?: OrderType;
  showBackLink?: boolean;
  compact?: boolean;
  canSwitchOrderType?: boolean;
  onOrderTypeChange?: (type: OrderType) => void;
  /** Pickup/delivery only — opens the OrderDetailsModal. Dine-in ignores this. */
  onOpenOrderDetails?: () => void;
  /** Tapped when the customer hits the "More" link — opens the About / Info screen. */
  onOpenInfo?: () => void;
  /** Scheduling label (e.g. "Today · 12:00 – 12:30") — shown when scheduled. */
  schedulingLabel?: string;
  /** Batch fulfillment config — when present, the hero suppresses the
   *  closing-hour segment (meaningless for weekly-preorder restaurants; the
   *  date + countdown lives in the ModeChip below). */
  batchConfig?: BatchFulfillmentConfigResponse | null;
  /** The order-type / fulfilment chip, rendered inline at the start of the web
   *  info row (sm+). On mobile the parent renders it on its own below the band,
   *  so this is shown only at the sm breakpoint. */
  webOrderChip?: React.ReactNode;
  /** Batch (bulk) restaurants whose order type is chosen at checkout have no
   *  order-type selector, so the fulfilment/opening info is shown as plain text
   *  at the start of the info line (Wolt "Open until …" style) instead of a
   *  chip. When set, this string is prepended to the info row and no order chip
   *  is rendered. */
  batchInlineStatus?: string;
};

/**
 * Restaurant hero — Wolt-style brand band, responsive.
 *
 *   • Mobile: a shorter cover, then the logo box straddles its bottom edge,
 *     centered, with the name + a single compact info line centered below.
 *   • Web (sm+): a taller cover with the logo box + name + tagline pinned
 *     bottom-left (overlaid on the cover), and a single horizontal info row
 *     below it.
 *
 * The logo box is white or black per `websiteConfig.heroLogoBg`, shown only
 * when the restaurant has a logo. The order-type / table identity lives in a
 * ModeChip rendered by the parent OrderExperience (full-width Wolt-style
 * button below the band on mobile, inline pill in the info row on sm+).
 */
export function RestaurantHero({
  restaurant,
  orderType,
  onOpenInfo,
  schedulingLabel,
  batchConfig,
  webOrderChip,
  batchInlineStatus,
}: Props) {
  const { t, direction } = useI18n();
  const { config: themeConfig, restaurantPreview } = useRestaurantTheme();
  // Read config from the resolved theme config (override-merged) so EVERY
  // website-builder edit shows up live in the preview iframe. For real
  // customers there is no override, so themeConfig === restaurant.websiteConfig
  // and this is a no-op. Falls back to the static prop if the provider is
  // absent (e.g. isolated stories).
  const websiteConfig = themeConfig ?? restaurant.websiteConfig;
  // Restaurant-level visuals (logo, cover, background) live on the Restaurant,
  // not WebsiteConfig, so they come through a separate preview channel. Layer
  // the live edit over the static prop; absent (real customers) → static prop.
  const logoUrl = restaurantPreview?.logoUrl ?? restaurant.logoUrl;
  const coverUrl = restaurantPreview?.coverUrl ?? restaurant.coverUrl;
  const coverDisplayMode = restaurantPreview?.coverDisplayMode ?? restaurant.coverDisplayMode;
  const coverFocalX = restaurantPreview?.coverFocalX ?? restaurant.coverFocalX;
  const coverFocalY = restaurantPreview?.coverFocalY ?? restaurant.coverFocalY;
  const backgroundColor = restaurantPreview?.backgroundColor ?? restaurant.backgroundColor;

  const batchEnabled =
    !!restaurant.batchFulfillmentEnabled &&
    !!batchConfig?.enabled &&
    !!batchConfig.fulfillmentDays?.[0];

  const heroNameFont = websiteConfig?.heroNameFont;
  // The logo always sits on the hero when present; only its box background is
  // configurable ("white" | "black"), defaulting to white.
  const logoBg = websiteConfig?.heroLogoBg === "black" ? "black" : "white";
  const hasLogo = !!logoUrl;
  // Cover composition. "logo" drops the name, tagline and rounded box and shows
  // the logo on its own, centered on the cover.
  const isLogoCover = websiteConfig?.heroCoverLayout === "logo";
  const heroFontWeights = heroNameFont
    ? websiteConfig?.typography?.extraFonts?.find((f) => f.family === heroNameFont)?.weights
    : undefined;
  useEffect(() => {
    ensureFont(heroNameFont, heroFontWeights);
  }, [heroNameFont, heroFontWeights]);

  // Mobile cover is kept short so the menu reaches the fold; web gets a taller
  // editorial cover that carries the bottom-left brand overlay.
  const coverHeightClass =
    "h-[26vh] min-h-[176px] max-h-[248px] sm:h-[32vh] sm:min-h-[230px] sm:max-h-[340px]";

  const useDefaultGradient = !coverUrl && !backgroundColor;
  const tagline = websiteConfig?.tagline || restaurant.description;
  const heroWeight = websiteConfig?.typography?.heroWeight;
  const nameFontStyle =
    heroNameFont || heroWeight
      ? {
          ...(heroNameFont ? { fontFamily: `"${heroNameFont}", serif` } : undefined),
          ...(heroWeight ? { fontWeight: heroWeight } : undefined),
        }
      : undefined;

  // ── Info line content
  const closingHourLabel = (() => {
    const cfg = restaurant.openingHoursConfig;
    if (cfg) {
      const days: (keyof typeof cfg.dine_in)[] = [
        "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
      ];
      const today = days[new Date().getDay()];
      const slot = cfg[orderType ?? "dine_in"]?.[today];
      if (slot && !slot.closed) return slot.close;
    }
    return restaurant.openingHours ?? null;
  })();

  const minOrder =
    (orderType === "delivery" || orderType === "pickup") &&
    restaurant.minimumOrderDelivery &&
    restaurant.minimumOrderDelivery > 0
      ? restaurant.minimumOrderDelivery
      : null;

  const wifiSSID =
    orderType === "dine_in" ? websiteConfig?.socialLinks?.wifi_ssid?.trim() : null;
  const wifiPassword =
    orderType === "dine_in" ? websiteConfig?.socialLinks?.wifi_password?.trim() : "";
  const [wifiSheetOpen, setWifiSheetOpen] = useState(false);

  const fulfilmentTime: { emoji: string; label: string } | null = (() => {
    if (restaurant.batchFulfillmentEnabled) return null;
    if (orderType === "pickup") {
      return {
        emoji: "🥡",
        label: `${t("readyIn") || "Ready in"} 15 ${t("minutes") || "min"}`,
      };
    }
    if (orderType === "delivery") {
      return { emoji: "🛵", label: `25–40 ${t("minutes") || "min"}` };
    }
    return null;
  })();

  // ── Metadata bar — driven by the website-builder config (per order mode).
  // Each item renders only when its data is present; an unconfigured restaurant
  // falls back to the default item set (see lib/orderPageInfo). Batch week,
  // WiFi and social are opt-in per mode; "Plus ›" shows when the modal has
  // content. Scheduling is session state, always appended when present.
  // Read order-page-info from the resolved theme config so the website builder's
  // live preview (postMessage override) updates instantly; falls back to the
  // static prop for the real customer page.
  const orderPageInfo = themeConfig?.orderPageInfo ?? websiteConfig?.orderPageInfo;
  const socialLinks = websiteConfig?.socialLinks ?? {};

  const socialChip = (platform: SocialPlatform): React.ReactNode => {
    const raw = (socialLinks as Record<string, string | undefined>)[platform]?.trim();
    if (!raw) return null;
    return (
      <a
        key={platform}
        href={socialHref(platform, raw)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center text-[var(--text)] active:opacity-70 transition"
        aria-label={platform}
      >
        {SOCIAL_ICON[platform]}
      </a>
    );
  };

  const barItemNodes: Record<Exclude<OrderPageBarItem, "more">, React.ReactNode> = {
    batch_week: batchInlineStatus ? <span key="batch">{batchInlineStatus}</span> : null,
    hours:
      !batchEnabled && closingHourLabel ? (
        <span key="open" className="inline-flex items-center gap-1.5">
          <span
            className="w-[7px] h-[7px] rounded-full"
            style={{
              background: "#39C46E",
              boxShadow: "0 0 0 2px rgba(57,196,110,0.22)",
              animation: "foody-pulse 2.4s ease-in-out infinite",
            }}
          />
          {t("openShort") || "Open"} · {closingHourLabel}
        </span>
      ) : null,
    min_order:
      minOrder !== null ? (
        <span key="min">
          {t("minShort") || "Min"} {currencySymbol("ILS")}
          {minOrder.toFixed(0)}
        </span>
      ) : null,
    fulfilment_time: fulfilmentTime ? (
      <span key="time">
        {fulfilmentTime.emoji} {fulfilmentTime.label}
      </span>
    ) : null,
    wifi: wifiSSID ? (
      <button
        key="wifi"
        onClick={() => setWifiSheetOpen(true)}
        className="inline-flex items-center gap-1 font-semibold text-[var(--text)] active:opacity-70 transition"
        aria-label={`${t("wifiSheetTitle") || "Connect to WiFi"} ${wifiSSID}`}
      >
        <span className="text-[13px]">📶</span>
        {t("wifiFree") || "Free WiFi"}
      </button>
    ) : null,
    instagram: socialChip("instagram"),
    whatsapp: socialChip("whatsapp"),
    facebook: socialChip("facebook"),
    tiktok: socialChip("tiktok"),
  };

  const barKeys = barItemsForMode(orderPageInfo, orderType);
  const rowItems: React.ReactNode[] = [];
  for (const key of barKeys) {
    // "more" is the Plus button, handled separately below; the rest are nodes.
    if (key !== "more" && barItemNodes[key]) rowItems.push(barItemNodes[key]);
  }
  if (schedulingLabel) rowItems.push(<span key="sched">📅 {schedulingLabel}</span>);
  // Plus button: shown only when enabled in the bar config AND the modal has
  // at least one section to open.
  if (barKeys.includes("more") && modalSectionsFor(orderPageInfo).length > 0) {
    rowItems.push(
      <button
        key="more"
        onClick={onOpenInfo}
        className="inline-flex items-center gap-0.5 font-semibold text-[var(--brand)] active:opacity-70 transition"
      >
        {t("more") || "More"}
        <svg
          className="w-3 h-3 rtl:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.6}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
        </svg>
      </button>,
    );
  }

  const infoRow = (justify: string) => (
    <div
      style={{ color: "var(--meta-text, var(--text-muted))" }}
      className={`flex flex-wrap items-center ${justify} gap-x-2 gap-y-1 text-[12px] sm:text-[13px] font-medium`}
    >
      {rowItems.map((node, i) => (
        <span key={i} className="inline-flex items-center gap-x-2">
          {i > 0 && <span aria-hidden className="opacity-40">·</span>}
          {node}
        </span>
      ))}
    </div>
  );

  return (
    <div className="relative" dir={direction}>
      {/* Cover photo. overflow-visible so the web logo box can straddle the
          bottom edge; the image itself is clipped by an inner layer. */}
      <div className={`relative w-full ${coverHeightClass}`}>
        <div className="absolute inset-0 overflow-hidden">
          {coverUrl ? (
            coverDisplayMode === "repeat" ? (
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `url(${coverUrl})`,
                  backgroundRepeat: "repeat",
                  backgroundSize: "auto 50%",
                  backgroundPosition: "left top",
                }}
              />
            ) : (
              <Image
                src={coverUrl}
                alt={restaurant.name}
                fill
                sizes="100vw"
                className={coverDisplayMode === "contain" ? "object-contain" : "object-cover"}
                style={{
                  objectPosition: `${clampPercent(coverFocalX)}% ${clampPercent(coverFocalY)}%`,
                }}
                priority
              />
            )
          ) : useDefaultGradient ? (
            <div className="absolute inset-0 bg-gradient-to-br from-brand to-brand-dark" />
          ) : (
            <div className="absolute inset-0" style={{ backgroundColor: backgroundColor || undefined }} />
          )}

          {/* Soft top gradient so the floating TopBar buttons stay legible */}
          <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-black/35 to-transparent pointer-events-none" />
          {/* Web-only bottom gradient so the white brand text reads on the cover.
              Skipped in logo-cover mode: there is no text, so it would only
              darken the cover. */}
          {!isLogoCover && (
            <div className="hidden sm:block absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent pointer-events-none" />
          )}
        </div>

        {/* LOGO-COVER mode — the logo on its own, centered directly on the
            cover (no box, no name, no tagline), on every breakpoint. */}
        {isLogoCover && hasLogo && (
          <div className="absolute inset-0 flex items-center justify-center px-6 pointer-events-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt={restaurant.name}
              className="max-h-[45%] max-w-[70%] sm:max-w-[55%] object-contain drop-shadow-[0_6px_24px_rgba(0,0,0,0.45)]"
            />
          </div>
        )}

        {/* WEB brand overlay — logo box + name + tagline pinned bottom-left,
            sitting entirely ON the cover (no straddle below it). items-center
            keeps the logo vertically centered with the name + tagline. */}
        <div className={`${isLogoCover ? "hidden" : "hidden sm:flex"} absolute inset-x-0 bottom-0 items-center gap-5 px-6 lg:px-12 pb-8 pointer-events-none`}>
          {hasLogo && (
            <div
              className={`shrink-0 w-[104px] h-[104px] lg:w-[116px] lg:h-[116px] rounded-[24px] flex items-center justify-center overflow-hidden border border-white/15 shadow-[0_10px_30px_rgba(0,0,0,0.5)] ${
                logoBg === "black" ? "bg-black" : "bg-white"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt={restaurant.name} className="w-full h-full object-contain p-3" />
            </div>
          )}
          <div className="min-w-0">
            <h1
              className="text-[42px] lg:text-[54px] leading-[1.0] font-extrabold tracking-[-0.02em] text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.6)] truncate"
              style={nameFontStyle}
            >
              {restaurant.name}
            </h1>
            {tagline && (
              <p className="mt-2 text-[13px] lg:text-[14px] font-bold uppercase tracking-[0.12em] text-white/80 drop-shadow-[0_1px_6px_rgba(0,0,0,0.6)]">
                {tagline}
              </p>
            )}
          </div>
        </div>

        {/* MOBILE logo — straddles the cover's bottom edge, centered. Anchored
            with absolute positioning (not a negative margin) so it lands
            reliably in the production build. translate-y-1/4 keeps ~3/4 of the
            box on the cover with the lower quarter dipping onto the band; z-20
            keeps that lower quarter above the band's background (which is a
            later sibling and would otherwise paint over it). Skipped in
            logo-cover mode, where the logo is centered on the cover instead. */}
        {!isLogoCover && hasLogo && (
          <div
            className={`sm:hidden absolute left-1/2 bottom-0 z-20 -translate-x-1/2 translate-y-1/4 w-[84px] h-[84px] rounded-[20px] flex items-center justify-center overflow-hidden border border-[var(--divider)] shadow-[0_8px_24px_rgba(0,0,0,0.30)] ${
              logoBg === "black" ? "bg-black" : "bg-white"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt={restaurant.name} className="w-full h-full object-contain p-2.5" />
          </div>
        )}
      </div>

      {/* WEB info row — single horizontal line below the cover, left-aligned:
          the order-type / fulfilment chip, then the info segments. pt clears
          the straddling logo above it. */}
      <div
        style={{ backgroundColor: "var(--meta-bg, var(--bg-page))" }}
        className={`hidden sm:flex items-center flex-wrap gap-x-3 gap-y-2 border-b border-[var(--divider)] pt-9 pb-5 pe-6 lg:pe-12 ${
          webOrderChip
            ? "ps-6 lg:ps-12"
            : // No leading chip: bare text starts at the rail, which reads
              // 16px left of the tab labels below (pills have px-4 internal
              // padding). Add that inset so the first word lines up with the
              // first tab label.
              "ps-10 lg:ps-16"
        }`}
      >
        {webOrderChip}
        {infoRow("justify-start")}
      </div>

      {/* MOBILE brand band — centered name + compact info line on the page
          background. pt-10 leaves room for the logo straddling in from the
          cover above. In logo-cover mode the name + tagline are dropped (the
          logo lives on the cover) and only the info line remains, so the band
          collapses to tight padding and is skipped entirely when there is no
          info to show. */}
      {(!isLogoCover || rowItems.length > 0) && (
        <div
          className={`sm:hidden relative px-5 text-center ${isLogoCover ? "pt-4 pb-4" : "pt-10 pb-6"}`}
          style={{ backgroundColor: "var(--hero-bg, var(--bg-page))" }}
        >
          {!isLogoCover && tagline && (
            <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--text-soft)] mb-1.5">
              {tagline}
            </p>
          )}
          {!isLogoCover && (
            <h1
              className="text-[31px] leading-[1.04] font-extrabold tracking-[-0.02em]"
              style={{ ...nameFontStyle, color: "var(--hero-text, var(--text))" }}
            >
              {restaurant.name}
            </h1>
          )}
          {rowItems.length > 0 && (
            <div className={isLogoCover ? "" : "mt-2.5"}>{infoRow("justify-center")}</div>
          )}
        </div>
      )}

      {/* Pulse keyframes for the live "Open" dot — scoped to this component */}
      <style>{`
        @keyframes foody-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(0.85); }
        }
      `}</style>

      {/* WiFi credentials sheet — opens when the customer taps the WiFi chip */}
      {wifiSSID && (
        <WifiSheet
          open={wifiSheetOpen}
          onClose={() => setWifiSheetOpen(false)}
          ssid={wifiSSID}
          password={wifiPassword || undefined}
        />
      )}
    </div>
  );
}
