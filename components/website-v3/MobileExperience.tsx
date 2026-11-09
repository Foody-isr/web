"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { InstallPrompt, isStandaloneApp } from "@/components/InstallPrompt";
import { localizedCopy, useI18n } from "@/lib/i18n";
import { fetchLoyaltyProgram } from "@/services/api";
import {
  defaultMobileExperience, mobileIcons, mobileText, readMobileExperience,
  type InstallPlacement, type MobileExperience, type MobileNavigationItem, type MobilePreview,
} from "@/lib/mobileExperience";
import { websiteContentUrl } from "@/lib/websiteComponents";
import type { Restaurant } from "@/lib/types";
import type { WebsiteV3Page } from "@/lib/websiteV3Api";
import { useCartStore } from "@/store/useCartStore";
import { MobileNavigationIcon, MobileTabBar } from "./MobileTabBar";

const targetDetails = {
  home: { icon: "home", label: "mobileNavHome", path: "" },
  order: { icon: "order", label: "mobileNavOrder", path: "/order" },
  loyalty: { icon: "gift", label: "mobileNavLoyalty", path: "/account/loyalty" },
  orders: { icon: "receipt", label: "mobileNavOrders", path: "/orders" },
  catering: { icon: "bag", label: "mobileNavCatering", path: "/catering" },
  more: { icon: "more", label: "mobileNavMore", path: "/account/more" },
  page: { icon: "info", label: "mobileNavLinks", path: "" },
  url: { icon: "link", label: "mobileNavLink", path: "" },
} as const;

type Surface = "more" | "loyalty" | "orders";
type LoyaltyMode = "points" | "visits";
type MobilePage = Pick<WebsiteV3Page, "slug" | "is_homepage" | "is_default" | "type">;
type ExperienceContext = {
  experience: MobileExperience | undefined;
  preview: MobilePreview | undefined;
  loyaltyMode: LoyaltyMode | undefined;
};
const MobileContext = createContext<ExperienceContext | undefined>(undefined);

function subscribeStandalone(onChange: () => void) {
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener?.("change", onChange);
  return () => media.removeEventListener?.("change", onChange);
}

/** Reads the public program only when a published mobile setting uses it. */
export function useMobileLoyalty(restaurantId: number, wanted: boolean, preview: boolean): LoyaltyMode | undefined {
  const program = useQuery({
    queryKey: ["loyalty-program", restaurantId],
    queryFn: ({ signal }) => fetchLoyaltyProgram(restaurantId, signal),
    enabled: wanted && !preview && Number.isSafeInteger(restaurantId) && restaurantId > 0,
    retry: false,
  });
  if (!wanted) return;
  return preview ? "points" : program.isSuccess ? program.data.rules.mode : undefined;
}

function restaurantHref(restaurant: Restaurant, suffix = ""): string {
  return "/r/" + encodeURIComponent(restaurant.slug || String(restaurant.id)) + suffix;
}

function secureWebsiteLink(value: string | undefined): string | undefined {
  const link = websiteContentUrl(value);
  if (!link?.startsWith("https://")) return;
  try {
    const parsed = new URL(link);
    return parsed.hostname && !parsed.username && !parsed.password ? link : undefined;
  } catch {
    return;
  }
}

function destination(item: MobileNavigationItem, restaurant: Restaurant, loyaltyMode?: LoyaltyMode) {
  const detail = targetDetails[item.target];
  if (!detail) return;
  const icon = item.icon && mobileIcons.includes(item.icon) ? item.icon : detail.icon;
  if (item.target === "url") {
    const href = secureWebsiteLink(item.value);
    if (href) return { href, icon, labelKey: detail.label, external: true as const, pageLabel: undefined };
    return;
  }
  if (item.target === "loyalty" && !loyaltyMode) return;
  if (item.target === "catering" && !restaurant.cateringEnabled) return;
  if (item.target === "orders" && restaurant.websiteConfig?.showOrdersLink === false) return;
  if (item.target === "order" && restaurant.cateringEnabled && restaurant.cateringOnly) return;
  if (item.target === "page") {
    const page = restaurant.websiteConfig?.pages?.find(page => page.slug === item.value);
    if (!page || (page.pageType === "catering" && !restaurant.cateringEnabled)) return;
    const path = page.isHomepage ? "" : page.isDefault && page.pageType === "order" ? "/order"
      : page.isDefault && page.pageType === "catering" ? "/catering" : "/" + encodeURIComponent(page.slug);
    return { href: restaurantHref(restaurant, path), icon, labelKey: detail.label, pageLabel: page.label, external: false as const };
  }
  return { href: restaurantHref(restaurant, detail.path), icon, labelKey: detail.label, external: false as const, pageLabel: undefined };
}

function isActiveTarget(item: MobileNavigationItem, page: MobilePage | undefined, surface: Surface | undefined, pathname: string): boolean {
  if (surface) return item.target === surface;
  switch (item.target) {
    case "home":
      return page?.is_homepage === true;
    case "order":
      return page?.type === "order" && (!page.is_homepage || pathname.endsWith("/order"));
    case "catering":
      return page?.type === "catering" && !page.is_homepage;
    case "page":
      return page?.slug === item.value;
    default:
      return false;
  }
}

/** Renders the same navigation and installation presentation in the draft preview and on the site. */
export function MobileExperienceSurface({
  restaurant, page, surface, preview, children,
}: {
  restaurant: Restaurant;
  page?: MobilePage;
  surface?: Surface;
  preview?: MobilePreview;
  children?: ReactNode;
}) {
  const i18n = useI18n();
  const pathname = usePathname();
  const installed = useSyncExternalStore(subscribeStandalone, isStandaloneApp, () => false);
  const [previewMore, setPreviewMore] = useState(false);
  const experience = readMobileExperience(restaurant.websiteConfig?.navLayout?.mobile_experience)
    ?? (preview ? defaultMobileExperience() : undefined);
  const navigationEnabled = experience?.navigation.enabled === true;
  const inPreview = Boolean(preview);
  const standalone = preview ? preview.mode === "standalone" : installed;
  const activeSurface = preview?.screen === "more" || previewMore ? "more" : surface;
  const wanted = Boolean(experience && (
    experience.installation.benefit === "loyalty" ||
    (navigationEnabled && (standalone || activeSurface === "more") &&
      experience.navigation.items.some(item => item.target === "loyalty" && item.placement !== "hidden"))
  ));
  const loyaltyMode = useMobileLoyalty(restaurant.id, wanted, inPreview);

  useEffect(() => setPreviewMore(false), [preview?.screen]);

  if (!experience) return children;
  const locale = preview?.locale ?? i18n.locale;
  const t = preview ? (key: string) => localizedCopy(locale, key) : i18n.t;
  const confirmation = preview?.screen === "confirmation";
  const items = experience.navigation.items.flatMap(item => {
    if (item.placement === "hidden") return [];
    const resolved = destination(item, restaurant, loyaltyMode);
    if (!resolved) return [];
    const fallback = item.target === "more"
      ? mobileText(experience.more.title, locale, t(resolved.labelKey), restaurant.name)
      : resolved.pageLabel ?? (item.target === "url" ? item.value ?? t(resolved.labelKey) : t(resolved.labelKey));
    const label = mobileText(item.label, locale, fallback, restaurant.name);
    return [{ item, ...resolved, label }];
  });
  const bar = items.filter(entry => entry.item.placement === "bar").slice(0, 5);
  const showBar = navigationEnabled && standalone
    && !confirmation && pathname !== "/order/cart" && bar.length > 0;
  const activeId = bar.find(entry => isActiveTarget(entry.item, page, activeSurface, pathname))?.item.id;

  return (
    <MobileContext.Provider value={{ experience, preview, loyaltyMode }}>
      <div className="mobile-experience" data-mobile-bar={showBar || undefined} data-mobile-style={experience.navigation.style}>
        {confirmation ? (
          <main className="mobile-more" dir={locale === "he" ? "rtl" : "ltr"}>
            <h1>{t("orderConfirmedSubtitle")}</h1>
            <MobileInstallEntry restaurant={restaurant} placement="confirmation" />
          </main>
        ) : activeSurface === "more" ? (
          <main className="mobile-more" dir={locale === "he" ? "rtl" : "ltr"}>
            <h1>{mobileText(experience.more.title, locale, t("mobileNavMore"), restaurant.name)}</h1>
            {experience.more.banner?.enabled && (
              <div className="mobile-more-banner">
                {secureWebsiteLink(experience.more.banner.image_url) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={secureWebsiteLink(experience.more.banner.image_url)} alt="" />
                )}
                <div>
                  <h2>{mobileText(experience.more.banner.title, locale, restaurant.name, restaurant.name)}</h2>
                  {experience.more.banner.subtitle?.[locale] && (
                    <p>{mobileText(experience.more.banner.subtitle, locale, "", restaurant.name)}</p>
                  )}
                </div>
              </div>
            )}
            {[...experience.more.groups, { id: "", title: {} }].map(group => {
              const links = items.filter(entry => entry.item.placement === "more" && (entry.item.group ?? "") === group.id);
              if (!links.length) return null;
              return (
                <section key={group.id} className="mobile-more-group">
                  <h2>{mobileText(group.title, locale, t("mobileNavLinks"), restaurant.name)}</h2>
                  <ul>
                    {links.map(({ item, href, icon, label, external }) => (
                      <li key={item.id}>
                        <Link href={href} prefetch={false} onClick={preview && (external || item.target === "loyalty" || item.target === "orders") ? event => event.preventDefault() : undefined}>
                          <MobileNavigationIcon icon={icon} size={23} />
                          <span>{label}</span>
                          <ChevronRightIcon width={16} aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
            <MobileInstallEntry restaurant={restaurant} placement="menu" />
          </main>
        ) : children}
        {showBar && (
          <MobileTabBar
            tabs={bar}
            activeId={activeId}
            colors={experience.navigation.colors}
            label={t("mobileNavLabel")}
            dir={locale === "he" ? "rtl" : "ltr"}
            scope={`${restaurant.id}:${preview ? "preview" : "site"}`}
            onTabClick={preview ? (event, { item, external }) => {
              if (item.target === "more") {
                event.preventDefault();
                setPreviewMore(true);
              } else if (external || item.target === "loyalty" || item.target === "orders") {
                event.preventDefault();
              } else {
                setPreviewMore(false);
              }
            } : undefined}
          />
        )}
      </div>
    </MobileContext.Provider>
  );
}

/** Provides the same restaurant-scoped install entry at each configured placement. */
export function MobileInstallEntry({ restaurant, placement }: { restaurant: Restaurant; placement: InstallPlacement }) {
  const context = useContext(MobileContext);
  const experience = context?.experience ?? readMobileExperience(restaurant.websiteConfig?.navLayout?.mobile_experience);
  const cartHasItems = useCartStore(state => state.restaurantId === String(restaurant.id) && state.lines.length > 0);
  if (!experience?.installation[placement] || (placement === "home" && !context?.preview && cartHasItems)) return null;
  return (
    <div className={placement === "home" ? "mobile-install-entry" : "mobile-install-menu-entry"}>
      <InstallPrompt
        restaurantId={String(restaurant.id)}
        restaurantName={restaurant.name}
        restaurantSlug={restaurant.slug}
        logoUrl={restaurant.logoUrl}
        installation={experience.installation}
        placement={placement}
        preview={context?.preview}
        loyaltyMode={context?.loyaltyMode}
        loyaltyHref={placement === "home" && context?.loyaltyMode ? restaurantHref(restaurant, "/account/loyalty") : undefined}
      />
    </div>
  );
}
