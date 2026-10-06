"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
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
import type { MenuItem, Restaurant } from "@/lib/types";
import { useI18n, useCurrency } from "@/lib/i18n";
import { useElementHeight } from "@/lib/useStickyChrome";
import { useCartStore } from "@/store/useCartStore";
import { useWebsiteOrderStore } from "@/store/useWebsiteOrderStore";
import { fetchMenu } from "@/services/api";
import { websiteOrderCopy, normalizeWebsiteOrder } from "@/lib/websiteOrder";
import { CartDrawer } from "@/components/CartDrawer";
import { InfoScreen } from "@/components/InfoScreen";
import { WebsiteFulfillmentDialog } from "./WebsiteFulfillmentDialog";
import { ensureFont } from "@/components/sections/typography";
import { useResolvedTheme } from "@/lib/themes/useResolvedTheme";
import { contrastInk } from "@/lib/themes/contrastInk";
import { usePreviewMode } from "@/lib/preview-mode";

/** Renders the Header component identically in draft, preview and published pages. */
export function SiteHeader({
  restaurant,
  value,
  onCart,
  onFulfillment,
  hideFulfillment = false,
}: {
  restaurant: Restaurant;
  value: WebsiteHeader;
  onCart?: () => void;
  onFulfillment?: () => void;
  hideFulfillment?: boolean;
}) {
  const header = normalizeWebsiteHeader(value),
    { locale, direction, t } = useI18n(),
    { money } = useCurrency(),
    router = useRouter();
  const copy = websiteOrderCopy(locale),
    rid = String(restaurant.id),
    slug = restaurant.slug || rid;
  const { resolved, config: liveConfig } = useResolvedTheme();
  const config = liveConfig ?? restaurant.websiteConfig;
  const pages = config?.pages ?? [],
    order =
      restaurant.cateringOnly && restaurant.cateringEnabled
        ? "/catering"
        : "/order";
  const href = (target: WebsiteHeader["button"]["link"]) =>
    headerTargetHref(target, slug, pages, order);
  const [menuOpen, setMenuOpen] = useState(false),
    [cartOpen, setCartOpen] = useState(false),
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
    selection = (preview ? previewSelection : stored) ?? {
      orderType: restaurant.pickupEnabled
        ? ("pickup" as const)
        : ("delivery" as const),
    };
  const lines = useCartStore((s) => s.lines),
    cartRestaurant = useCartStore((s) => s.restaurantId);
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
        header.scroll === "reveal" && next > height && next > previous + 2,
      );
      previous = next;
    };
    window.addEventListener("scroll", scroll, { passive: true });
    return () => window.removeEventListener("scroll", scroll);
  }, [header.scroll, height]);
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--nav-sticky-h",
      header.scroll === "none" || hidden ? "0px" : `${height}px`,
    );
    return () => {
      document.documentElement.style.removeProperty("--nav-sticky-h");
    };
  }, [height, header.scroll, hidden]);
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
  const base = {
    default: [pageBg, ink],
    light: ["#ffffff", "#111111"],
    dark: ["#111111", "#ffffff"],
    accent: [brand, contrastInk(brand)],
    surface: [colors?.surface || "#f5f5f5", ink],
    soft: [`color-mix(in srgb, ${brand} 10%, ${pageBg})`, ink],
  }[header.color_style];
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
  const buttonColor = header.button.color ||
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
    position: header.scroll === "none" ? "relative" : "sticky",
    transform: hidden ? "translateY(-110%)" : undefined,
  } as CSSProperties;
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
        background: header.logo.custom_background
          ? header.logo.background
          : undefined,
      }}
      aria-label={header.logo.text || restaurant.name}
    >
      {header.logo.type === "image" && header.logo.image ? (
        <img
          src={header.logo.image}
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
  const nav =
    header.navigation.enabled && header.navigation.links.length > 0 ? (
      <nav
        className="website-header-links"
        data-header-element="navigation"
        data-header-label={t("navPrimary") || "Navigation"}
        aria-label={t("navPrimary") || "Navigation"}
        style={{
          textTransform: header.navigation.uppercase ? "uppercase" : undefined,
          color: header.navigation.color || undefined,
        }}
      >
        <ul>{header.navigation.links.map((link) => renderLink(link))}</ul>
      </nav>
    ) : (
      <div className="website-header-links" />
    );
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
  const openCart = () => (onCart ? onCart() : setCartOpen(true));
  const openFulfillment = () =>
    onFulfillment ? onFulfillment() : setFulfillmentOpen(true);
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
        style={style}
      >
        <div className="website-header-inner">
          <button
            className="website-header-menu"
            aria-label={t("navPrimary") || "Menu"}
            onClick={() => setMenuOpen(true)}
          >
            <Menu width={24} height={24} />
          </button>
          {logo}
          {nav}
          <div className="website-header-actions">
            {button}
            <div
              data-header-element="icons"
              data-header-label={
                locale === "fr" ? "Icônes" : locale === "he" ? "סמלים" : "Icons"
              }
              className="website-header-icons"
              style={{ color: header.icons.color || undefined }}
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
                <button aria-label={labels.cart} onClick={openCart}>
                  <ShoppingCart width={22} height={22} />
                  {count > 0 && (
                    <span className="website-header-count">{count}</span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
        {header.fulfillment.enabled &&
          !hideFulfillment &&
          (restaurant.pickupEnabled || restaurant.deliveryEnabled) && (
            <div
              className="website-header-fulfillment"
              data-header-element="fulfillment"
              data-header-label={copy.change}
              style={{
                background:
                  header.fulfillment.background ||
                  "color-mix(in srgb, currentColor 7%, transparent)",
              }}
            >
              <span>
                {selection.orderType === "delivery"
                  ? selection.address
                    ? `${copy.deliveryTo} ${selection.address}`
                    : copy.delivery
                  : copy.pickup}
                {selection.orderType === "pickup" && restaurant.address && (
                  <small>{restaurant.address}</small>
                )}
              </span>
              <button onClick={openFulfillment}>{copy.change}</button>
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
          restaurantId={rid}
          isolatePreview
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          currency={restaurant.currency || "ILS"}
          previewMode={preview}
          orderType={selection.orderType}
          onCheckout={() => router.push(`/r/${slug}${order}`)}
        />
      )}
      {!onFulfillment && (
        <WebsiteFulfillmentDialog
          open={fulfillmentOpen}
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
