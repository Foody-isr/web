"use client";
import { resolveSiteColorStyle } from "@/lib/siteColors";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MagnifyingGlassIcon as Search,
  ShoppingCartIcon as ShoppingCart,
  Bars3Icon as Menu,
  XMarkIcon as X,
  ChevronDownIcon as ChevronDown,
} from "@heroicons/react/24/outline";
import {
  type WebsiteHeader,
  type HeaderLink,
  headerTargetHref,
  normalizeWebsiteHeader,
} from "@/lib/websiteHeader";
import type { MenuItem, Restaurant, BatchFulfillmentConfigResponse } from "@/lib/types";
import { useI18n, useCurrency } from "@/lib/i18n";
import { useElementHeight } from "@/lib/useStickyChrome";
import { useCartStore } from "@/store/useCartStore";
import { useWebsiteOrderStore } from "@/store/useWebsiteOrderStore";
import { fetchMenu } from "@/services/api";
import { websiteOrderCopy, normalizeWebsiteOrder } from "@/lib/websiteOrder";
import { CartDrawer } from "@/components/CartDrawer";
import { InfoScreen } from "@/components/InfoScreen";
import { WebsiteServiceBar } from "./WebsiteServiceBar";
import { WebsiteFulfillmentDialog } from "./WebsiteFulfillmentDialog";
import { ensureFont } from "@/components/sections/typography";
import { useResolvedTheme } from "@/lib/themes/useResolvedTheme";
import { contrastInk } from "@/lib/themes/contrastInk";
import { usePreviewMode } from "@/lib/preview-mode";
import { formatDateLabel } from "@/lib/scheduling";
import { WebsiteRestaurantInfo } from "./WebsiteRestaurantInfo";
import { resolveWebsiteOrderType, websiteFulfillmentRules } from "@/lib/websiteFulfillment";
import { HeaderNavigation } from "./HeaderNavigation";
import { useWebsiteCart, type WebsiteCartInteraction } from "@/hooks/useWebsiteCart";

/** Renders the Header component identically in draft, preview and published pages. */
export function SiteHeader({
  restaurant,
  value,
  onCart,
  cartInteraction,
  onFulfillment,
  hideFulfillment = false,
  fulfillmentContent,
  batchConfig,
}: {
  restaurant: Restaurant;
  value: WebsiteHeader;
  onCart?: () => void;
  cartInteraction?: WebsiteCartInteraction;
  onFulfillment?: () => void;
  hideFulfillment?: boolean;
  fulfillmentContent?: ReactNode;
  batchConfig?: BatchFulfillmentConfigResponse | null;
}) {
  const header = normalizeWebsiteHeader(value),
    { locale, direction, t } = useI18n(),
    { money } = useCurrency(),
    router = useRouter();
  const restaurantLayout = header.layout === "restaurant";
  const copy = websiteOrderCopy(locale),
    rid = String(restaurant.id),
    slug = restaurant.slug || rid;
  const { resolved, config: liveConfig } = useResolvedTheme();
  const config = liveConfig ?? restaurant.websiteConfig;
  const rules = websiteFulfillmentRules({...restaurant, websiteConfig: config});
  const pages = config?.pages ?? [],
    order =
      restaurant.cateringOnly && restaurant.cateringEnabled
        ? "/catering"
        : "/order";
  const href = (target: WebsiteHeader["button"]["link"]) =>
    headerTargetHref(target, slug, pages, order);
  const ownCart = useWebsiteCart();
  const cart = cartInteraction ?? ownCart;
  const [menuOpen, setMenuOpen] = useState(false),
    [searchOpen, setSearchOpen] = useState(false),
    [fulfillmentOpen, setFulfillmentOpen] = useState(false),
    [infoOpen, setInfoOpen] = useState(false);
  const [hidden, setHidden] = useState(false),
    [scrolled, setScrolled] = useState(false),
    [query, setQuery] = useState(""),
    [items, setItems] = useState<MenuItem[]>([]),
    [loadState, setLoadState] = useState<
      "idle" | "loading" | "error" | "ready"
    >("idle"),
    [retry, setRetry] = useState(0);
  const [previewSelection, setPreviewSelection] = useState<{
    orderType: "pickup" | "delivery";
    address?: string;
  }>();
  const stored = useWebsiteOrderStore((s) => s.selections[rid]),
    select = useWebsiteOrderStore((s) => s.select);
  const preview = usePreviewMode(),
    rawSelection = (preview ? previewSelection : stored) ?? {
      orderType: restaurant.pickupEnabled
        ? ("pickup" as const)
        : ("delivery" as const),
    };
  const selection = { ...rawSelection, orderType: resolveWebsiteOrderType(restaurant, rawSelection.orderType) as "pickup" | "delivery" };
  const lines = useCartStore((s) => s.lines),
    cartRestaurant = useCartStore((s) => s.restaurantId);
  const cartTourId = useCartStore((s) => s.tourId);
  const count =
    !preview && cartRestaurant === rid
      ? lines.reduce((total, line) => total + line.quantity, 0)
      : 0;
  const navRef = useRef<HTMLElement>(null),
    searchRef = useRef<HTMLDialogElement>(null),
    menuRef = useRef<HTMLDialogElement>(null),
    height = useElementHeight(navRef);
  const font = config?.typography?.site?.bodyFont || resolved?.fonts.body;
  useEffect(() => {
    if (font) ensureFont(font);
  }, [font]);
  useEffect(() => {
    let previous = window.scrollY;
    const scroll = () => {
      const next = window.scrollY;
      setScrolled(next > 20);
      setHidden(
        !restaurantLayout && header.scroll === "reveal" && next > height && next > previous + 2,
      );
      previous = next;
    };
    window.addEventListener("scroll", scroll, { passive: true });
    return () => window.removeEventListener("scroll", scroll);
  }, [header.scroll, height, restaurantLayout]);
  useEffect(() => {
    document.documentElement.style.setProperty("--website-header-height", `${height}px`);
    document.documentElement.style.setProperty(
      "--nav-sticky-h",
      restaurantLayout || header.scroll === "none" || hidden ? "0px" : `${height}px`,
    );
    return () => {
      document.documentElement.style.removeProperty("--nav-sticky-h");
      document.documentElement.style.removeProperty("--website-header-height");
    };
  }, [height, header.scroll, hidden, restaurantLayout]);
  useEffect(() => {
    const dialog = searchRef.current;
    if (searchOpen) dialog?.showModal();
    else dialog?.close();
    return () => dialog?.close();
  }, [searchOpen]);
  useEffect(() => {
    const dialog = menuRef.current;
    if (menuOpen) dialog?.showModal();
    else dialog?.close();
    return () => dialog?.close();
  }, [menuOpen]);
  useEffect(() => {
    if (!searchOpen) return;
    let active = true;
    setLoadState("loading");
    fetchMenu(rid)
      .then((result) => {
        if (!active) return;
        const all = result.menus.flatMap((menu) => menu.items);
        setItems([...new Map(all.map((item) => [item.id, item])).values()]);
        setLoadState("ready");
      })
      .catch(() => {
        if (active) setLoadState("error");
      });
    return () => {
      active = false;
    };
  }, [searchOpen, rid, retry]);
  const colors = resolved?.theme.tokens.colors;
  const brand =
    resolved?.brandColorOverride ||
    colors?.accent ||
    config?.brandColor ||
    "#111111";
  const ink = colors?.ink || "#111111",
    pageBg = colors?.bg || "#ffffff";
  const sharedStyle = resolveSiteColorStyle({bg: pageBg, ink, accent: brand, surface: colors?.surface, ...config?.customPalette}, header.color_style);
  const legacyBase: Record<string, string[]> = {
    default: [pageBg, ink],
    light: ["#ffffff", "#111111"],
    dark: ["#111111", "#ffffff"],
    accent: [brand, contrastInk(brand)],
    surface: [colors?.surface || "#f5f5f5", ink],
    soft: [`color-mix(in srgb, ${brand} 10%, ${pageBg})`, ink],
  };
  const base = sharedStyle ? [sharedStyle.background, sharedStyle.paragraph] : legacyBase[header.color_style] || legacyBase.default;
  const bg = header.background;
  const background =
    bg.mode === "transparent"
      ? scrolled
        ? base[0]
        : "transparent"
      : bg.mode === "color"
        ? bg.color || base[0]
        : bg.mode === "gradient"
          ? `linear-gradient(${bg.angle}deg, ${bg.color || base[0]}, ${bg.end})`
          : bg.mode === "image" && bg.image
            ? `linear-gradient(rgb(0 0 0 / ${bg.overlay / 100}),rgb(0 0 0 / ${bg.overlay / 100})),url(${JSON.stringify(bg.image)}) center / cover`
            : base[0];
  const buttonColor = header.button.color || (header.button.style === "outline" ? sharedStyle?.outline_button : sharedStyle?.solid_button) ||
    ((header.color_style === 'accent' || header.color_style === 'dark') && contrastInk(brand) === contrastInk(base[0]) ? base[1] : brand);
  const customButtonText = header.button.color
    ? contrast(header.button.color)
    : contrastInk(buttonColor);
  const style = {
    "--header-brand": brand,
    "--header-brand-ink": contrastInk(brand),
    "--header-bg": base[0],
    "--header-ink": base[1],
    background,
    color: base[1],
    fontFamily: font ? `"${font}",sans-serif` : undefined,
    position: restaurantLayout || header.scroll === "none" ? "relative" : "sticky",
    transform: !restaurantLayout && hidden ? "translateY(-110%)" : undefined,
  } as CSSProperties;
  const infoStyle = resolveSiteColorStyle({bg: pageBg, ink, accent: brand, ...config?.customPalette}, header.restaurant.info_color_style);
  const cover = bg.mode === "image" ? bg.image || restaurant.coverUrl : undefined;
  const coverStyle: CSSProperties = restaurantLayout ? {
    background: cover ? `linear-gradient(to top, rgb(0 0 0 / ${Math.max(0.45, bg.overlay / 100)}), transparent), url(${JSON.stringify(cover)})` : base[0],
    backgroundSize: "cover",
    backgroundPosition: `${restaurant.coverFocalX ?? 50}% ${restaurant.coverFocalY ?? 50}%`,
    color: sharedStyle?.title || base[1],
  } : {};
  const logoImage = header.logo.image || (restaurantLayout ? restaurant.logoUrl : undefined);
  const logoHref = href(header.logo.link) || `/r/${slug}`;
  const logo = (
    <Link
      href={logoHref}
      target={header.logo.link.new_tab ? "_blank" : undefined}
      rel={header.logo.link.new_tab ? "noopener noreferrer" : undefined}
      data-header-element="logo"
      data-header-label={
        locale === "fr" ? "Logo" : locale === "he" ? "לוגו" : "Logo"
      }
      className="website-header-logo"
      style={{
        "--header-logo-size": `${header.logo.size}px`,
        background: restaurantLayout ? "#ffffff" : header.logo.custom_background
          ? header.logo.background
          : undefined,
      } as CSSProperties}
      aria-label={header.logo.text || restaurant.name}
    >
      {header.logo.type === "image" && logoImage ? (
        <img
          src={logoImage}
          alt={header.logo.text || restaurant.name}
          style={{ height: header.logo.size }}
        />
      ) : (
        <span style={{ fontSize: Math.min(64, header.logo.size / 2) }}>
          {header.logo.text || restaurant.name}
        </span>
      )}
    </Link>
  );
  const renderLink = (link: HeaderLink, mobile = false) => {
    const url = href(link.target),
      children = link.children?.filter((child) => href(child.target));
    if (!url && !children?.length) return null;
    const anchor = url ? (
      <Link
        href={url}
        target={link.target.new_tab ? "_blank" : undefined}
        rel={link.target.new_tab ? "noopener noreferrer" : undefined}
        onClick={() => setMenuOpen(false)}
      >
        {link.label}
      </Link>
    ) : (
      <span>{link.label}</span>
    );
    return (
      <li key={link.id}>
        {children?.length ? (
          <details
            className={`website-header-submenu ${header.navigation.mode === "mega" && !mobile ? "is-mega" : ""}`}
          >
            <summary>
              {link.label}
              <ChevronDown width={14} height={14} />
            </summary>
            <ul>
              <li>{anchor}</li>
              {children.map((child) => renderLink(child, mobile))}
            </ul>
          </details>
        ) : (
          anchor
        )}
      </li>
    );
  };
  const navigationLinks = header.navigation.links.filter(link => href(link.target) || link.children?.some(child => href(child.target)));
  const nav = header.navigation.enabled ? (
    <HeaderNavigation links={navigationLinks} renderLink={renderLink} moreLabel={t("more")}
      label={t("navPrimary") || "Navigation"} uppercase={header.navigation.uppercase} color={header.navigation.color} />
  ) : <div className="website-header-links" />;
  const buttonHref = href(header.button.link);
  const button =
    header.button.enabled && buttonHref ? (
      <Link
        data-header-element="button"
        data-header-label={
          locale === "fr" ? "Bouton" : locale === "he" ? "כפתור" : "Button"
        }
        className="website-header-button"
        href={buttonHref}
        target={header.button.link.new_tab ? "_blank" : undefined}
        rel={header.button.link.new_tab ? "noopener noreferrer" : undefined}
        style={{
          background:
            header.button.style === "filled" ? buttonColor : "transparent",
          color:
            header.button.style === "filled" ? customButtonText : buttonColor,
          borderColor: buttonColor,
          borderRadius:
            config?.typography?.site?.buttonShape === "square"
              ? 0
              : config?.typography?.site?.buttonShape === "rounded"
                ? 8
                : 999,
        }}
      >
        {header.button.text ||
          (locale === "fr"
            ? "Commander"
            : locale === "he"
              ? "להזמנה"
              : "Order Now")}
      </Link>
    ) : null;
  const cartParams = new URLSearchParams({ restaurantId: rid, orderType: selection.orderType });
  if (cartRestaurant === rid && cartTourId) cartParams.set("tourId", String(cartTourId));
  if (rules.canChooseTime && stored?.schedulingIntent && !preview) {
    cartParams.set("isScheduled", "true");
    cartParams.set("scheduledFor", stored.schedulingIntent.scheduledFor);
    cartParams.set("scheduledPickupWindowStart", stored.schedulingIntent.selectedSlot.start);
    cartParams.set("scheduledPickupWindowEnd", stored.schedulingIntent.selectedSlot.end);
  }
  const openCart = () => {
    if (preview) return;
    cart.setOpen(false);
    if (onCart) onCart();
    else router.push(`/order/cart?${cartParams.toString()}`);
  };
  const openFulfillment = () => {
    if (rules.canChooseOnMenu) { if (onFulfillment) onFulfillment(); else setFulfillmentOpen(true); }
  };
  const results = items.filter((item) =>
    item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const labels =
    locale === "fr"
      ? {
          search: "Rechercher",
          cart: "Panier",
          close: "Fermer",
          empty: "Aucun article trouvé",
          loading: "Chargement…",
          error: "Impossible de charger les articles.",
          retry: "Réessayer",
        }
      : locale === "he"
        ? {
            search: "חיפוש",
            cart: "סל קניות",
            close: "סגירה",
            empty: "לא נמצאו פריטים",
            loading: "טוען…",
            error: "לא ניתן לטעון פריטים.",
            retry: "ניסיון חוזר",
          }
        : {
            search: "Search",
            cart: "Cart",
            close: "Close",
            empty: "No items found",
            loading: "Loading…",
            error: "Unable to load items.",
            retry: "Try again",
          };
  return (
    <>
      <header
        ref={navRef}
        dir={direction}
        className="website-header"
        data-layout={header.layout}
        data-editor-region="header"
        data-editor-label="Header"
        style={restaurantLayout ? {...style, background: base[0]} : style}
      >
        <div className={restaurantLayout ? "website-restaurant-cover" : undefined} data-height={header.restaurant.height} style={coverStyle}>
        <div className="website-header-inner">
          <button
            className="website-header-menu"
            aria-label={t("navPrimary") || "Menu"}
            onClick={() => setMenuOpen(true)}
          >
            <Menu width={24} height={24} />
          </button>
          {!restaurantLayout && logo}
          {!restaurantLayout && nav}
          <div className="website-header-actions">
            {!restaurantLayout && button}
            <div
              data-header-element="icons"
              data-header-label={
                locale === "fr" ? "Icônes" : locale === "he" ? "סמלים" : "Icons"
              }
              className="website-header-icons"
              style={{ color: restaurantLayout ? undefined : header.icons.color || undefined }}
            >
              {header.icons.search && (
                <button
                  aria-label={labels.search}
                  onClick={() => setSearchOpen(true)}
                >
                  <Search width={22} height={22} />
                </button>
              )}
              {header.icons.cart && (
                <button data-commerce-cart aria-label={labels.cart} onClick={openCart}
                  aria-haspopup="dialog" aria-expanded={cart.open}
                  onPointerEnter={cart.enterTrigger} onPointerLeave={cart.scheduleClose}>
                  <ShoppingCart width={22} height={22} />
                  {count > 0 && (
                    <span className="website-header-count">{count}</span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
        {restaurantLayout && <div className="website-restaurant-brand">
          {header.logo.type === "image" && logoImage && logo}
          {header.restaurant.show_name && <h1>{header.logo.text || restaurant.name}</h1>}
        </div>}
        </div>
        {restaurantLayout && <WebsiteRestaurantInfo restaurant={{...restaurant, websiteConfig: config}} settings={header.restaurant} orderType={selection.orderType} batchConfig={batchConfig} style={{background: infoStyle?.background || base[0], color: infoStyle?.paragraph || base[1]}} />}
        {(!restaurantLayout || rules.canChooseOnMenu) && (fulfillmentContent || (header.fulfillment.enabled && !hideFulfillment && (restaurant.pickupEnabled || restaurant.deliveryEnabled))) && (
          <div className="website-header-fulfillment" data-header-element="fulfillment"
            data-header-label={copy.change}>
            {fulfillmentContent || <WebsiteServiceBar
              location={selection.orderType === "delivery"
                ? selection.address ? `${copy.deliveryTo} ${selection.address}` : copy.delivery
                : `${copy.pickupAt} ${restaurant.address || restaurant.name}`}
              locationLabel={copy.change}
              infoLabel={copy.info}
              time={rules.canChooseTime && stored?.schedulingIntent && !preview ? `${formatDateLabel(stored.schedulingIntent.scheduledFor, locale)} · ${stored.schedulingIntent.selectedSlot.start}` : undefined}
              onLocation={rules.canChooseOnMenu ? openFulfillment : undefined}
              onInfo={() => setInfoOpen(true)}
            />}
          </div>
        )}
      </header>
      <dialog
        ref={menuRef}
        className="website-header-menu-dialog"
        style={{ background: base[0], color: base[1] }}
        dir={direction}
        onCancel={() => setMenuOpen(false)}
        aria-label={t("navPrimary") || "Navigation"}
      >
        <button
          className="website-header-close"
          aria-label={labels.close}
          onClick={() => setMenuOpen(false)}
        >
          <X width={24} height={24} />
        </button>
        <nav>
          <ul>
            {header.navigation.enabled &&
              header.navigation.links.map((link) => renderLink(link, true))}
          </ul>
        </nav>
        {button}
      </dialog>
      <dialog
        ref={searchRef}
        className="website-header-search-dialog"
        style={{ background: pageBg, color: ink }}
        dir={direction}
        onCancel={() => setSearchOpen(false)}
        aria-label={labels.search}
      >
        <div className="website-header-search-top">
          <Search width={24} height={24} />
          <input
            autoFocus
            type="search"
            aria-label={labels.search}
            placeholder={labels.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            aria-label={labels.close}
            onClick={() => setSearchOpen(false)}
          >
            <X width={24} height={24} />
          </button>
        </div>
        {loadState === "loading" ? (
          <p role="status">{labels.loading}</p>
        ) : loadState === "error" ? (
          <p role="alert">
            {labels.error}{" "}
            <button onClick={() => setRetry(retry + 1)}>{labels.retry}</button>
          </p>
        ) : (
          <ul>
            {results.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/r/${slug}${order}?item=${encodeURIComponent(item.id)}`}
                  onClick={() => setSearchOpen(false)}
                >
                  {item.name}
                  <span>{money(item.price)}</span>
                </Link>
              </li>
            ))}
            {results.length === 0 && <p>{labels.empty}</p>}
          </ul>
        )}
      </dialog>
      {!onCart && (
        <CartDrawer
          websiteMode
          cartInteraction={cart}
          restaurantId={rid}
          isolatePreview
          open={cart.open}
          onClose={() => cart.setOpen(false)}
          currency={restaurant.currency || "ILS"}
          previewMode={preview}
          orderType={selection.orderType}
          minimumOrderDelivery={restaurant.minimumOrderDelivery ?? 0}
          onCheckout={openCart}
        />
      )}
      {!onFulfillment && (
        <WebsiteFulfillmentDialog
          open={fulfillmentOpen && rules.canChooseOnMenu}
          restaurant={restaurant}
          design={normalizeWebsiteOrder({})}
          selection={selection}
          onClose={() => setFulfillmentOpen(false)}
          onInfo={() => {
            setFulfillmentOpen(false);
            setInfoOpen(true);
          }}
          onConfirm={(value) =>
            preview ? setPreviewSelection(value) : select(rid, value)
          }
        />
      )}
      {infoOpen && (
        <InfoScreen
          open
          restaurant={restaurant}
          orderType={selection.orderType}
          onClose={() => setInfoOpen(false)}
        />
      )}
    </>
  );
}
function contrast(hex: string) {
  let c = hex.slice(1);
  if (c.length === 3)
    c = c
      .split("")
      .map((x) => x + x)
      .join("");
  return 0.299 * parseInt(c.slice(0, 2), 16) +
    0.587 * parseInt(c.slice(2, 4), 16) +
    0.114 * parseInt(c.slice(4, 6), 16) >
    160
    ? "#111111"
    : "#ffffff";
}
