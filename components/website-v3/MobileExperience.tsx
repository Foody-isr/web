"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { InstallPrompt, isStandaloneApp } from "@/components/InstallPrompt";
import { localizedCopy, useI18n } from "@/lib/i18n";
import { RestaurantThemeProvider } from "@/lib/restaurant-theme";
import { fetchLoyaltyProgram } from "@/services/api";
import {
  defaultMobileExperience, mobileIcons, mobileText, readMobileExperience,
  type InstallPlacement, type MobileAppHome as AppHome, type MobileExperience, type MobileNavigationItem, type MobilePreview,
} from "@/lib/mobileExperience";
import { websiteContentUrl } from "@/lib/websiteComponents";
import type { NavLayout, Restaurant, WebsiteConfig } from "@/lib/types";
import type { WebsiteV3Page } from "@/lib/websiteV3Api";
import { useCartStore } from "@/store/useCartStore";
import { MobileNavigationIcon, MobileTabBar } from "./MobileTabBar";
import { MobileTabPages } from "@/components/mobile-experience/MobileTabPages";

const MobileAppHome = dynamic(() => import("@/components/mobile-experience/MobileAppHome").then(module => module.MobileAppHome));

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

type LoyaltyMode = "points" | "visits";
type MobilePage = Pick<WebsiteV3Page, "slug" | "is_homepage" | "is_default" | "type">;
export type MobileExperiencePreview = MobilePreview & { siteRestaurant: Restaurant };
type MobileRestaurant = Pick<Restaurant, "id" | "name" | "slug" | "logoUrl" | "cateringEnabled" | "cateringOnly"> & {
  websiteConfig?: Pick<WebsiteConfig, "pages" | "showOrdersLink"> & {
    navLayout?: Pick<NavLayout, "mobile_experience"> | null;
  };
};
type ExperienceContext = {
  experience: MobileExperience;
  preview: MobilePreview | undefined;
  loyaltyMode: LoyaltyMode | undefined;
  standalone: boolean;
  appNavigation: boolean;
  links: MobileLink[];
};
const MobileContext = createContext<ExperienceContext | undefined>(undefined);

const mobileViewport = "(max-width: 767px)";

function installedMobileDisplay(mode?: MobilePreview["mode"]) {
  return window.matchMedia(mobileViewport).matches && (mode ? mode === "standalone" : isStandaloneApp());
}

function subscribeMobileDisplay(onChange: () => void) {
  const queries = [window.matchMedia("(display-mode: standalone)"), window.matchMedia(mobileViewport)];
  queries.forEach(query => query.addEventListener?.("change", onChange));
  return () => queries.forEach(query => query.removeEventListener?.("change", onChange));
}

/** Indicates that app navigation has replaced the website header and footer. */
export function useMobileAppNavigation() {
  return useContext(MobileContext)?.appNavigation === true;
}

/** Selects the app home at the same public address used by existing installations. */
export function MobileHomeBoundary({ home, restaurant, orderHref, browserHref, children }: {
  home: AppHome;
  restaurant: Restaurant;
  orderHref: string;
  browserHref?: string;
  children?: ReactNode;
}) {
  const standalone = useContext(MobileContext)?.standalone === true;
  const router = useRouter();
  const { t } = useI18n();
  useEffect(() => {
    if (browserHref && !installedMobileDisplay()) router.replace(browserHref);
  }, [browserHref, router]);
  if (standalone) return <MobileAppHome home={home} restaurant={restaurant} orderHref={orderHref} />;
  return <div className="contents mobile-home-web-fallback">
    {children ?? (browserHref ? <main className="p-5"><Link href={browserHref}>{t("mobileNavHome")}</Link></main> : null)}
  </div>;
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

function restaurantHref(restaurant: MobileRestaurant, suffix = ""): string {
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

function pagePath(page: NonNullable<WebsiteConfig["pages"]>[number]): string {
  if (page.isDefault && page.pageType === "order") return "/order";
  if (page.isDefault && page.pageType === "catering") return "/catering";
  if (page.isHomepage && page.pageType !== "order" && page.pageType !== "catering") return "";
  return "/" + encodeURIComponent(page.slug);
}

function destination(item: MobileNavigationItem, restaurant: MobileRestaurant, loyaltyMode?: LoyaltyMode) {
  const detail = targetDetails[item.target];
  if (!detail) return;
  const icon = item.icon && mobileIcons.includes(item.icon) ? item.icon : detail.icon;
  if (item.target === "url") {
    const href = secureWebsiteLink(item.value);
    if (href) return { path: href, icon, labelKey: detail.label, external: true as const, pageLabel: undefined };
    return;
  }
  if (item.target === "loyalty" && !loyaltyMode) return;
  if (item.target === "catering" && !restaurant.cateringEnabled) return;
  if (item.target === "orders" && restaurant.websiteConfig?.showOrdersLink === false) return;
  if (item.target === "order" && restaurant.cateringEnabled && restaurant.cateringOnly) return;
  if (item.target === "page") {
    const page = restaurant.websiteConfig?.pages?.find(page => page.slug === item.value);
    if (!page || (page.pageType === "catering" && !restaurant.cateringEnabled)) return;
    return { path: pagePath(page), icon, labelKey: detail.label, pageLabel: page.label, external: false as const };
  }
  return { path: detail.path, icon, labelKey: detail.label, external: false as const, pageLabel: undefined };
}

type MobileLink = NonNullable<ReturnType<typeof destination>> & {
  item: MobileNavigationItem;
  href: string;
  label: string;
};

function currentTab(links: MobileLink[], path: string, restaurant: MobileRestaurant): string | undefined {
  const exact = links.find(link => !link.external && link.path === path);
  if (exact) return exact.item.id;
  const page = restaurant.websiteConfig?.pages?.find(candidate => pagePath(candidate) === path);
  const target = path.startsWith("/catering/") ? "catering" : page?.pageType;
  return links.find(link => link.item.target === target)?.item.id;
}

function isActiveTarget(item: MobileNavigationItem, page: MobilePage | undefined, more: boolean, pathname: string): boolean {
  if (more) return item.target === "more";
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

/** Keeps the live tab bar mounted in the restaurant layout, or renders its editor preview. */
export function MobileExperienceSurface({
  restaurant, restaurantKey, cleanPaths, page, preview, children,
}: {
  restaurant: MobileRestaurant;
  restaurantKey?: string;
  cleanPaths?: boolean;
  page?: MobilePage;
  preview?: MobileExperiencePreview;
  children?: ReactNode;
}) {
  const i18n = useI18n();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const standalone = useSyncExternalStore(
    subscribeMobileDisplay,
    () => installedMobileDisplay(preview?.mode),
    () => false,
  );
  const [previewMore, setPreviewMore] = useState(false);
  const [previewHome, setPreviewHome] = useState(false);
  const experience = readMobileExperience(restaurant.websiteConfig?.navLayout?.mobile_experience)
    ?? (preview ? defaultMobileExperience() : undefined);
  const navigationEnabled = experience?.navigation.enabled === true;
  const inPreview = Boolean(preview);
  const editorFrame = !inPreview && searchParams?.get("preview") === "1";
  const previewMorePage = inPreview && !previewHome && (preview?.screen === "more" || previewMore);
  const previewHomePage = standalone && !previewMorePage && experience?.home &&
    preview && (preview.screen === "home" || previewHome);
  const restaurantRoot = "/r/" + encodeURIComponent(restaurantKey || restaurant.slug || String(restaurant.id));
  const path = (pathname === restaurantRoot || pathname.startsWith(restaurantRoot + "/")
    ? pathname.slice(restaurantRoot.length)
    : pathname).replace(/\/$/, "");
  const wanted = Boolean(experience && (
    experience.installation.benefit === "loyalty" ||
    (navigationEnabled && (standalone || previewMorePage || path === "/account/more") &&
      experience.navigation.items.some(item => item.target === "loyalty" && item.placement !== "hidden"))
  ));
  const loyaltyMode = useMobileLoyalty(restaurant.id, wanted && !editorFrame, inPreview);

  useEffect(() => {
    setPreviewMore(false);
    setPreviewHome(false);
  }, [preview?.screen]);

  if (!experience || editorFrame) return children;
  const locale = preview?.locale ?? i18n.locale;
  const t = preview ? (key: string) => localizedCopy(locale, key) : i18n.t;
  const confirmation = preview?.screen === "confirmation";
  const lang = searchParams?.get("lang");
  const localeQuery = !inPreview && (lang === "en" || lang === "fr" || lang === "he") ? "?lang=" + lang : "";
  const links = experience.navigation.items.flatMap<MobileLink>(item => {
    if (item.placement === "hidden") return [];
    const resolved = destination(item, restaurant, loyaltyMode);
    if (!resolved) return [];
    const fallback = item.target === "more"
      ? mobileText(experience.more.title, locale, t(resolved.labelKey), restaurant.name)
      : resolved.pageLabel ?? (item.target === "url" ? item.value ?? t(resolved.labelKey) : t(resolved.labelKey));
    const label = mobileText(item.label, locale, fallback, restaurant.name);
    const prefix = cleanPaths && resolved.path !== "/orders" ? "" : restaurantRoot;
    const href = resolved.external ? resolved.path : ((prefix + resolved.path) || "/") + localeQuery;
    return [{ item, ...resolved, href, label }];
  });
  const bar = links.filter(entry => entry.item.placement === "bar").slice(0, 5);
  const appNavigation = navigationEnabled && standalone && bar.length > 0;
  const showBar = appNavigation && !confirmation && pathname !== "/order/cart"
    && !/^\/(?:payment|t|table)(?:\/|$)/.test(path);
  const activeId = preview
    ? bar.find(entry => previewHomePage ? entry.item.target === "home" : isActiveTarget(entry.item, page, previewMorePage, pathname))?.item.id
    : currentTab(bar, path, restaurant);
  const navigation = showBar && (
    <MobileTabBar
      tabs={bar}
      activeId={activeId}
      colors={experience.navigation.colors}
      label={t("mobileNavLabel")}
      dir={locale === "he" ? "rtl" : "ltr"}
      prefetchInternal={!inPreview}
      onTabClick={preview ? (event, { item, external }) => {
        if (item.target === "more") {
          event.preventDefault();
          setPreviewMore(true);
          setPreviewHome(false);
        } else if (item.target === "home" && experience.home) {
          event.preventDefault();
          setPreviewMore(false);
          setPreviewHome(true);
        } else if (external || item.target === "loyalty" || item.target === "orders") {
          event.preventDefault();
        } else {
          setPreviewMore(false);
          setPreviewHome(false);
        }
      } : undefined}
    />
  );

  return (
    <MobileContext.Provider value={{ experience, preview, loyaltyMode, standalone, appNavigation, links }}>
      <div className="mobile-experience" data-mobile-app={appNavigation || undefined} data-mobile-bar={showBar || undefined} data-mobile-style={experience.navigation.style}>
        {preview ? (
          <>
            {confirmation ? (
              <main className="mobile-confirmation-preview" dir={locale === "he" ? "rtl" : "ltr"}>
                <h1>{t("orderConfirmedSubtitle")}</h1>
                <MobileInstallEntry restaurant={restaurant} placement="confirmation" />
              </main>
            ) : previewMorePage ? <MobileMoreContent restaurant={restaurant} siteConfig={preview.siteRestaurant.websiteConfig ?? null} />
              : previewHomePage && experience.home ? <MobileAppHome home={experience.home} restaurant={preview.siteRestaurant}
                orderHref={restaurantRoot + (restaurant.cateringEnabled && restaurant.cateringOnly ? "/catering" : "/order")} previewLocale={locale} />
              : children}
            {navigation}
          </>
        ) : (
          <MobileTabPages enabled={appNavigation} tabHrefs={bar.filter(tab => !tab.external).map(tab => tab.href)} navigation={navigation}>
            {children}
          </MobileTabPages>
        )}
      </div>
    </MobileContext.Provider>
  );
}

/** Renders the Plus page with the same published or preview links as the tab bar. */
export function MobileMoreContent({ restaurant, siteConfig }: {
  restaurant: MobileRestaurant;
  siteConfig: WebsiteConfig | null;
}) {
  const context = useContext(MobileContext);
  const i18n = useI18n();
  if (!context) return null;
  const { experience, preview, links } = context;
  const locale = preview?.locale ?? i18n.locale;
  const t = preview ? (key: string) => localizedCopy(locale, key) : i18n.t;
  const banner = experience.more.banner;
  const image = banner?.enabled ? secureWebsiteLink(banner.image_url) : undefined;
  const content = (
    <main className="mobile-more" dir={locale === "he" ? "rtl" : "ltr"}>
      <h1>{mobileText(experience.more.title, locale, t("mobileNavMore"), restaurant.name)}</h1>
      {banner?.enabled && (
        <div className="mobile-more-banner">
          {image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" />
          )}
          <div>
            <h2>{mobileText(banner.title, locale, restaurant.name, restaurant.name)}</h2>
            {banner.subtitle?.[locale] && <p>{mobileText(banner.subtitle, locale, "", restaurant.name)}</p>}
          </div>
        </div>
      )}
      {[...experience.more.groups, { id: "", title: {} }].map(group => {
        const groupLinks = links.filter(entry => entry.item.placement === "more" && (entry.item.group ?? "") === group.id);
        if (!groupLinks.length) return null;
        return (
          <section key={group.id} className="mobile-more-group">
            <h2>{mobileText(group.title, locale, t("mobileNavLinks"), restaurant.name)}</h2>
            <ul>
              {groupLinks.map(({ item, href, icon, label, external }) => (
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
  );
  return <RestaurantThemeProvider config={siteConfig} pageMode="website">{content}</RestaurantThemeProvider>;
}

/** Provides the same restaurant-scoped install entry at each configured placement. */
export function MobileInstallEntry({ restaurant, placement }: { restaurant: MobileRestaurant; placement: InstallPlacement }) {
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
