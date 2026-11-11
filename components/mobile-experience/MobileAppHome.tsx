"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CampaignHero } from "@/components/sections/CampaignHero";
import { MenuHighlightsSection } from "@/components/sections/MenuHighlightsSection";
import { restaurantTimezone } from "@/lib/availability";
import { localizedCopy, useI18n } from "@/lib/i18n";
import { mobileHomePeriodIsCurrent, mobileText, type MobileAppHome as AppHome, type MobileLocale } from "@/lib/mobileExperience";
import { RestaurantThemeProvider } from "@/lib/restaurant-theme";
import type { Restaurant, WebsiteSection } from "@/lib/types";

function periodLabel(home: AppHome, locale: MobileLocale) {
  const from = home.featured_from ? new Date(home.featured_from + "T00:00:00Z") : undefined;
  const through = home.featured_through ? new Date(home.featured_through + "T00:00:00Z") : undefined;
  if ((!from && !through) || (from && !Number.isFinite(from.getTime())) ||
    (through && !Number.isFinite(through.getTime())) || (from && through && from > through)) return;
  const format = new Intl.DateTimeFormat(locale, {
    month: "short", day: "numeric", timeZone: "UTC",
    ...(from && through && from.getUTCFullYear() !== through.getUTCFullYear() ? { year: "numeric" } : {}),
  });
  if (from && through) return format.formatRange(from, through);
  if (from) return localizedCopy(locale, "mobileHomePeriodFrom").replace("{date}", format.format(from));
  if (through) return localizedCopy(locale, "mobileHomePeriodThrough").replace("{date}", format.format(through));
}

/** Renders the restaurant's installed-app home with the shared site design. */
export function MobileAppHome({ home, restaurant, orderHref, previewLocale }: {
  home: AppHome;
  restaurant: Restaurant;
  orderHref: string;
  previewLocale?: MobileLocale;
}) {
  const { locale: siteLocale } = useI18n();
  const locale = previewLocale ?? siteLocale;
  const [now, setNow] = useState(() => new Date());
  const lead = useRef<HTMLDivElement>(null);
  const [passedLead, setPassedLead] = useState(false);
  const sticky = home.sticky_order !== false;
  const scheduled = Boolean(home.featured_from || home.featured_through);

  useEffect(() => {
    if (!sticky || !lead.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      setPassedLead(!entry.isIntersecting && entry.boundingClientRect.bottom <= 0);
    });
    observer.observe(lead.current);
    return () => observer.disconnect();
  }, [sticky]);

  useEffect(() => {
    if (!scheduled || previewLocale) return;
    const refresh = () => setNow(new Date());
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [previewLocale, scheduled]);

  const label = mobileText(home.order_label, locale, localizedCopy(locale, "mobileHomeOrder"), restaurant.name);
  const height = home.hero_height === 66 || home.hero_height === 88 ? home.hero_height : 76;
  const hero: WebsiteSection = {
    id: 0, sectionType: "hero_banner", layout: "campaign", page: "home", sortOrder: 0, isVisible: true,
    content: { headline: restaurant.name, ...home.hero?.content },
    settings: {
      card_width_percent: 100, card_width_percent_mobile: 100, card_gap: 0, autoplay: true,
      controls_alignment: "left", ...home.hero?.settings,
    },
  };
  const featured: WebsiteSection = {
    id: 0, sectionType: "menu_highlights", layout: home.featured?.layout === "carousel" ? "carousel" : "grid",
    page: "home", sortOrder: 1, isVisible: true,
    content: { title: localizedCopy(locale, "mobileHomeFeatured"), ...home.featured?.content },
    settings: {
      auto_select_items: home.featured?.settings?.item_source !== "custom", item_source: "automatic", max_items: 6,
      show_prices: false, image_fit: "contain", ...home.featured?.settings,
    },
  };
  const showFeatured = home.featured_enabled !== false && !(restaurant.cateringEnabled && restaurant.cateringOnly) &&
    (previewLocale || mobileHomePeriodIsCurrent(home, restaurantTimezone(restaurant), now));
  return (
    <RestaurantThemeProvider config={restaurant.websiteConfig ?? null} pageMode="website">
      <main className="mobile-app-home" data-sticky-order={sticky || undefined} dir={locale === "he" ? "rtl" : "ltr"}>
        <div ref={lead} className="mobile-home-lead" style={{ "--mobile-home-hero-height": `${height}svh` } as CSSProperties}>
          <CampaignHero section={hero} restaurant={restaurant} appOrder={{ href: orderHref, label, locale }} />
        </div>
        {showFeatured && (
          <MenuHighlightsSection section={featured} restaurant={restaurant}
            appHome={{ orderHref, locale, period: periodLabel(home, locale) }} />
        )}
        {sticky && passedLead && (
          <Link href={orderHref} className="mobile-home-order website-campaign-cta">{label}</Link>
        )}
      </main>
    </RestaurantThemeProvider>
  );
}
