"use client";

import { useQuery } from "@tanstack/react-query";
import type { CSSProperties, ReactNode } from "react";
import type { BatchFulfillmentConfigResponse, OrderType, Restaurant } from "@/lib/types";
import type { WebsiteHeader } from "@/lib/websiteHeader";
import { useI18n, useCurrency } from "@/lib/i18n";
import { fetchBatchFulfillmentConfig } from "@/services/api";
import { checkRestaurantAvailability, availabilityReasonText } from "@/lib/availability";
import { formatBatchStatusInline } from "@/components/ModeChip";
import { SOCIAL_ICON, socialHref, type SocialPlatform } from "@/components/RestaurantSocial";

/** Shows live restaurant facts; it never introduces an ordering or scheduling choice. */
export function WebsiteRestaurantInfo({ restaurant, settings, orderType, style, batchConfig }: {
  restaurant: Restaurant;
  settings: WebsiteHeader["restaurant"];
  orderType: OrderType;
  style: CSSProperties;
  batchConfig?: BatchFulfillmentConfigResponse | null;
}) {
  const { t, locale } = useI18n();
  const { money } = useCurrency();
  const batch = useQuery({
    queryKey: ["restaurant-header-batch", restaurant.id, orderType],
    queryFn: () => fetchBatchFulfillmentConfig(restaurant.id, orderType),
    enabled: settings.info_enabled && settings.show_status && !!restaurant.batchFulfillmentEnabled && batchConfig === undefined,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  if (!settings.info_enabled) return null;
  const items: ReactNode[] = [];
  if (settings.show_status) {
    const config = batchConfig ?? batch.data;
    if (restaurant.batchFulfillmentEnabled) {
      const unavailable = locale === "fr" ? "Disponibilités indisponibles" : locale === "he" ? "פרטי הזמינות אינם זמינים" : "Availability unavailable";
      items.push(<span key="status" role="status">{batch.isError ? unavailable : config?.enabled ? `${t("preOrder")} · ${formatBatchStatusInline(config, locale, t("opensAt"))}` : t("preOrder")}</span>);
    } else {
      const availability = checkRestaurantAvailability(restaurant, orderType);
      const reason = availabilityReasonText(availability.reason, t(orderType === "delivery" ? "delivery" : "pickup"), t);
      items.push(<span key="status" role="status">{availability.isOpen ? [t("openShort"), availability.closesAt].filter(Boolean).join(" · ") : [t("closed"), reason].filter(Boolean).join(" · ")}</span>);
    }
  }
  if (settings.show_minimum && orderType === "delivery" && (restaurant.minimumOrderDelivery ?? 0) > 0) {
    items.push(<span key="minimum">{t("minShort")} {money(restaurant.minimumOrderDelivery!)}</span>);
  }
  if (settings.show_social) {
    const links = restaurant.websiteConfig?.socialLinks;
    for (const platform of ["instagram", "whatsapp", "facebook", "tiktok"] as SocialPlatform[]) {
      const value = links?.[platform]?.trim();
      if (value) items.push(<a key={platform} href={socialHref(platform, value)} aria-label={platform} target="_blank" rel="noopener noreferrer">{SOCIAL_ICON[platform]}</a>);
    }
  }
  if (!items.length) return null;
  return <div className="website-restaurant-info" data-header-element="restaurant" style={style}>
    {items.map((item, index) => <span className="website-restaurant-info-item" key={index}>{index > 0 && <span aria-hidden="true" className="website-restaurant-separator">·</span>}{item}</span>)}
  </div>;
}
