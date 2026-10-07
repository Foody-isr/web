"use client";
import { useResolvedTheme } from "@/lib/themes/useResolvedTheme";
import {
  resolveSiteColorStyle,
  siteColorReference,
  sectionSiteColorId,
} from "@/lib/siteColors";
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { deriveItemPortion } from "@/lib/portion";
import { roleTextStyle, type TypeRoleKey } from "@/lib/themes/typography";
import { CategoryBanner } from "@/components/themed/CategoryBanner/CategoryBanner";
import {
  orderCardColorVariables,
  orderNavigationColorVariables,
} from "@/lib/websiteOrderColors";
import { categoryBarStyle } from "@/components/CategoryTabs";
import type {
  MenuData,
  MenuItem,
  Restaurant,
  WebsiteSection,
} from "@/lib/types";
import { OrderDiscoveryRail } from "@/components/OrderDiscoveryRail";
import {
  orderDiscoveryPlacement,
  orderDiscoverySections,
} from "@/lib/orderDiscovery";
import { useI18n, useCurrency } from "@/lib/i18n";
import { useMenuLanguage } from "@/lib/menu-language";
import { tField } from "@/lib/translations";
import {
  itemDisplayPriceRange,
  isByWeight,
  weightEstimatePrice,
} from "@/lib/cart";
import {
  websiteOrderMenus,
  websiteItemAvailable,
  websiteOrderCopy,
  type WebsiteOrderDesign,
} from "@/lib/websiteOrder";

/** The editable storefront catalogue shares existing item/cart behavior and public menu membership. */
export function WebsiteOrderMenu({
  menus,
  design,
  onSelect,
  restaurant,
  sections = [],
  onOpenNavigation,
  onOpenCart,
  cartCount = 0,
  cartEnabled = false,
}: {
  menus: MenuData[];
  restaurant?: Restaurant;
  sections?: WebsiteSection[];
  design: WebsiteOrderDesign;
  onSelect: (item: MenuItem) => void;
  onOpenNavigation?: () => void;
  onOpenCart?: () => void;
  cartCount?: number;
  cartEnabled?: boolean;
}) {
  const { locale, t } = useI18n();
  const { menuLocale } = useMenuLanguage();
  const { money } = useCurrency();
  const copy = websiteOrderCopy(locale);
  const { config } = useResolvedTheme();
  const hasChildStyle = design.cardColorStyle !== "default" || design.categoryColorStyle !== "default";
  const colorStyle = sectionSiteColorId(
    hasChildStyle ? { color_styles: true } : config?.customPalette,
    design.colorStyle,
  );
  const [query, setQuery] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const root = useRef<HTMLElement>(null);
  const navigation = useRef<HTMLDivElement>(null);
  const [activeAnchor, setActiveAnchor] = useState("");
  const visible = useMemo(
    () => websiteOrderMenus(menus, query, availableOnly),
    [menus, query, availableOnly],
  );
  const multipleMenus = useMemo(
    () => websiteOrderMenus(menus).length > 1,
    [menus],
  );
  const placements = orderDiscoverySections(sections).map((section) => ({
    section,
    placement: orderDiscoveryPlacement(
      section,
      visible.flatMap((menu) => menu.groups.map((group) => String(group.id))),
    ),
  }));
  const discovery = (
    groupId: string,
    edge: "before" | "after" | number,
    count = 0,
  ) =>
    restaurant &&
    placements
      .filter(
        ({ placement }) =>
          placement.groupId === groupId &&
          (typeof edge === "number"
            ? placement.mode === "inside_group" &&
              edge === Math.min(placement.insertAfterItems, count)
            : placement.mode === "between_groups" && placement.edge === edge),
      )
      .map(({ section }) => (
        <OrderDiscoveryRail
          key={section.id}
          section={section}
          restaurant={restaurant}
          desktopGap="regular"
        />
      ));
  const anchor = (menu: MenuData, groupId?: string) =>
    `menu-${menu.entryKey}${groupId ? `-${groupId}` : ""}`;
  const links = visible.flatMap((menu) =>
    multipleMenus
      ? [{ id: anchor(menu), name: menu.name }]
      : menu.groups.map((group) => ({
          id: anchor(menu, String(group.id)),
          name: tField(group, "name", menuLocale),
        })),
  );
  const anchorIds = links.map((link) => link.id).join("|");
  useEffect(() => {
    const targets = Array.from(
      root.current?.querySelectorAll<HTMLElement>("[data-order-anchor]") ?? [],
    );
    let frame = 0;
    const update = () => {
      const edge = design.stickyCategories
        ? (navigation.current?.getBoundingClientRect().bottom ?? 0) + 24
        : 96;
      let current = targets[0]?.id ?? "";
      for (const target of targets) {
        if (target.getBoundingClientRect().top <= edge) current = target.id;
        else break;
      }
      setActiveAnchor(current);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [anchorIds, design.stickyCategories]);
  const colors: Record<string, [string, string]> = {
    default: ["var(--bg-page)", "var(--text)"],
    light: ["#ffffff", "#111111"],
    dark: ["#111111", "#ffffff"],
    accent: ["var(--brand)", "var(--ink-on-accent)"],
    surface: ["var(--surface-subtle)", "var(--text)"],
    soft: [
      "color-mix(in srgb, var(--brand) 12%, var(--bg-page))",
      "var(--text)",
    ],
  };
  const sharedStyle =
    !!resolveSiteColorStyle(config?.customPalette, colorStyle) ||
    hasChildStyle;
  const [background, foreground] = colors[colorStyle] || colors.default;
  const backgroundImage =
    design.backgroundKind === "image" && design.backgroundImage
      ? `url(${JSON.stringify(design.backgroundImage)})`
      : design.backgroundKind === "gradient"
        ? `linear-gradient(135deg, ${design.background ?? "#ffffff"}, ${design.backgroundEnd})`
        : undefined;
  const textStyle = (
    text: WebsiteOrderDesign["itemTitleText"],
    role: TypeRoleKey,
    baseSize: string,
    color: string,
  ): CSSProperties =>
    text.style === "inherit"
      ? {
          ...roleTextStyle(
            role,
            baseSize,
            role === "categoryTitle" ? "display" : "body",
            role === "itemName" || role === "itemPrice" ? 700 : 500,
            text.caps ? "uppercase" : "none",
            color,
          ),
          textAlign: text.alignment,
          color,
        }
      : {
          fontFamily: text.style.startsWith("title")
            ? "var(--font-display)"
            : "var(--font-body)",
          fontSize: {
            "title-1": 48,
            "title-2": 36,
            "title-3": 28,
            "title-4": 20,
            "paragraph-1": 20,
            "paragraph-2": 18,
            "paragraph-3": 16,
          }[text.style],
          fontWeight:
            text.weight === "bold"
              ? 700
              : text.weight === "semibold"
                ? 600
                : 400,
          textAlign: text.alignment,
          textTransform: text.caps ? "uppercase" : "none",
          color,
        };
  return (
    <section
      ref={root}
      data-editor-region="order-items"
      data-color-style={colorStyle}
      data-shared-colors={sharedStyle}
      className="website-order-menu"
      data-width={design.contentWidth}
      data-card-style={design.cardStyle}
      data-columns={design.layout === "single" ? 1 : design.columns}
      style={
        {
          ...(sharedStyle
            ? {
                ...siteColorReference(colorStyle),
                "--cat-heading": "var(--site-title)",
                "--type-categorytitle-color": "var(--site-title)",
              }
            : {}),
          backgroundColor:
            design.backgroundKind === "color"
              ? design.background
              : sharedStyle
                ? "var(--site-background, var(--bg-page))"
                : background,
          color: sharedStyle
            ? "var(--site-paragraph, var(--text))"
            : foreground,
          backgroundImage,
          backgroundSize: "cover",
          backgroundPosition: "center",
          "--website-order-columns":
            design.layout === "single" ? 1 : design.columns,
          ...(sharedStyle
            ? {}
            : {
                "--order-card-bg":
                  design.cardBackground ??
                  (design.cardStyle === "filled"
                    ? "var(--surface, var(--site-background))"
                    : "transparent"),
                "--order-card-title":
                  design.cardTitleColor ??
                  (design.cardStyle === "filled"
                    ? "var(--type-itemname-color, var(--text))"
                    : "var(--site-title, var(--text))"),
                "--order-card-description":
                  design.cardDescriptionColor ??
                  "var(--type-itemdescription-color, var(--text-muted, currentColor))",
                "--order-description-opacity": design.cardDescriptionColor
                  ? 1
                  : 0.7,
                "--order-card-price":
                  design.cardPriceColor ??
                  (design.cardStyle === "filled"
                    ? "var(--type-itemprice-color, var(--price, currentColor))"
                    : "currentColor"),
                "--order-card-border":
                  design.cardBorderColor ?? "var(--divider, #dddddd)",
                "--order-category-bg":
                  design.cardStyle === "filled"
                    ? "var(--brand-dark, var(--surface))"
                    : "transparent",
                "--order-category-active-bg":
                  design.categoryShape === "plain"
                    ? "transparent"
                    : "var(--text)",
                "--order-category-active-text":
                  design.categoryShape === "plain"
                    ? "inherit"
                    : "var(--brand-dark, var(--surface))",
              }),
        } as CSSProperties
      }
    >
      <div className="website-order-tools">
        {design.showAvailabilityFilter && (
          <select
            aria-label={copy.available}
            value={availableOnly ? "available" : "all"}
            onChange={(event) =>
              setAvailableOnly(event.target.value === "available")
            }
          >
            <option value="all">{copy.all}</option>
            <option value="available">{copy.available}</option>
          </select>
        )}
      </div>
      <div
        ref={navigation}
        className="website-order-navigation"
        data-sticky={design.stickyCategories}
        data-shape={design.categoryShape}
        data-color-style={sharedStyle ? design.categoryColorStyle : undefined}
        style={
          (sharedStyle
            ? orderNavigationColorVariables(design)
            : design.cardStyle === "filled"
              ? categoryBarStyle(false)
              : undefined) as CSSProperties
        }
      >
        {design.cardStyle === "filled" && onOpenNavigation && (
          <button
            className="website-order-menu-toggle"
            type="button"
            aria-label={t("navPrimary")}
            onClick={onOpenNavigation}
          >
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 6h14M5 12h14M5 18h14" />
            </svg>
          </button>
        )}
        {design.showSearch && (
          <button
            className="website-order-search-toggle"
            aria-label={copy.search}
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen(!searchOpen)}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="10" cy="10" r="6" />
              <path d="m15 15 5 5" />
            </svg>
          </button>
        )}
        {design.showSearch && (
          <input
            data-open={searchOpen}
            aria-label={copy.search}
            placeholder={copy.search}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        )}
        {design.showCategories && (
          <nav
            aria-label={copy.categories}
            data-caps={design.categoryCaps}
            data-background={design.categoryBackground}
            style={{
              ...textStyle(
                design.categoryText,
                "categoryBar",
                "1rem",
                "inherit",
              ),
              justifyContent:
                design.categoryAlignment === "center"
                  ? "center"
                  : design.categoryAlignment === "end"
                    ? "flex-end"
                    : "flex-start",
            }}
          >
            <div>
              {links.map((link) => (
                <a
                  key={link.id}
                  href={`#${link.id}`}
                  aria-current={
                    (activeAnchor || links[0]?.id) === link.id
                      ? "location"
                      : undefined
                  }
                  onClick={() => setActiveAnchor(link.id)}
                >
                  {link.name}
                </a>
              ))}
            </div>
          </nav>
        )}
        {design.cardStyle === "filled" && onOpenCart && (
          <button
            className="website-order-cart-toggle"
            type="button"
            disabled={!cartEnabled}
            aria-label={`${t("cart")}${cartCount > 0 ? ` · ${cartCount}` : ""}`}
            onClick={onOpenCart}
          >
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 3h2l3 13h11l2-10H6" />
              <circle cx="9" cy="20" r="1" />
              <circle cx="18" cy="20" r="1" />
            </svg>
            {cartCount > 0 && <small>{cartCount}</small>}
          </button>
        )}
      </div>
      {visible.length === 0 && (
        <p className="py-16 text-center">{copy.noResults}</p>
      )}
      {visible.map((menu) => (
        <div
          key={menu.entryKey}
          id={anchor(menu)}
          data-order-anchor={multipleMenus || undefined}
          className="website-order-menu-group"
        >
          {multipleMenus && <h2>{menu.name}</h2>}
          {menu.groups.map((group) => (
            <div
              key={group.id}
              id={anchor(menu, String(group.id))}
              data-order-anchor={!multipleMenus || undefined}
              className="website-order-category"
            >
              {discovery(String(group.id), "before")}
              {design.showCategoryTitles &&
                (design.categoryTitleText.style === "inherit" ? (
                  <CategoryBanner
                    name={tField(group, "name", menuLocale)}
                    imageUrl={group.imageUrl}
                    description={group.description}
                    design={group.bannerDesign}
                    focalX={group.focalX}
                    focalY={group.focalY}
                  />
                ) : (
                  <h3
                    style={textStyle(
                      design.categoryTitleText,
                      "categoryTitle",
                      "2rem",
                      "var(--site-title, var(--text))",
                    )}
                  >
                    {tField(group, "name", menuLocale)}
                  </h3>
                ))}
              <div className="website-order-items" data-layout={design.layout}>
                {group.items.map((item, itemIndex) => {
                  const price = itemDisplayPriceRange(item);
                  const available = websiteItemAvailable(item);
                  const portion = deriveItemPortion(item, menuLocale).label;
                  return (
                    <Fragment key={item.id}>
                      <button
                        aria-label={tField(item, "name", menuLocale)}
                        onClick={() => onSelect(item)}
                        disabled={!available}
                        className="website-order-item"
                        data-layout={design.layout}
                        data-border={design.cardBorder}
                        data-radius={design.cardRadius}
                        data-card-style={design.cardStyle}
                        data-color-style={
                          sharedStyle ? design.cardColorStyle : undefined
                        }
                        style={
                          sharedStyle
                            ? (orderCardColorVariables(design) as CSSProperties)
                            : undefined
                        }
                      >
                        <span className="website-order-item-copy">
                          <span className="website-order-item-heading">
                            {design.showItemTitles && (
                              <strong
                                style={textStyle(
                                  design.itemTitleText,
                                  "itemName",
                                  "1rem",
                                  "var(--order-card-title)",
                                )}
                              >
                                {tField(item, "name", menuLocale)}
                              </strong>
                            )}
                            {design.showPortions && portion && (
                              <span className="website-order-item-portion">
                                {portion}
                              </span>
                            )}
                            {design.showDescriptions && item.description && (
                              <span
                                className="website-order-item-description"
                                style={{
                                  ...roleTextStyle(
                                    "itemDescription",
                                    ".875rem",
                                    "body",
                                    400,
                                    "none",
                                  ),
                                  color: "var(--order-card-description)",
                                }}
                              >
                                {tField(item, "description", menuLocale)}
                              </span>
                            )}
                          </span>
                          <span className="website-order-item-bottom">
                            {design.showPrices && (
                              <span
                                className="website-order-item-price"
                                style={textStyle(
                                  design.itemPriceText,
                                  "itemPrice",
                                  "1rem",
                                  "var(--order-card-price)",
                                )}
                              >
                                {isByWeight(item)
                                  ? money(weightEstimatePrice(item))
                                  : design.priceDisplay === "starting" ||
                                      price.min === price.max
                                    ? money(price.min)
                                    : `${money(price.min)} – ${money(price.max)}`}
                              </span>
                            )}
                            {design.showBadges && !available && (
                              <small>{t("soldOut")}</small>
                            )}
                            {design.showBadges &&
                              available &&
                              item.availabilityState === "low" && (
                                <small className="website-order-item-stock">
                                  {item.buildableCount != null
                                    ? `${item.buildableCount} ${t("left")}`
                                    : t("lowStock")}
                                </small>
                              )}
                          </span>
                        </span>
                        {design.showImages &&
                          item.imageUrl &&
                          design.layout !== "text" &&
                          design.layout !== "single" && (
                            <span
                              className="website-order-item-media"
                              data-radius={design.imageRadius}
                              data-action={
                                available ? design.itemAction : "none"
                              }
                            >
                              <img
                                src={item.imageUrl}
                                alt=""
                                loading="lazy"
                                style={{
                                  aspectRatio:
                                    design.imageRatio === "landscape"
                                      ? "4 / 3"
                                      : design.imageRatio === "portrait"
                                        ? "3 / 4"
                                        : "1",
                                  objectFit: design.imageFit as
                                    | "cover"
                                    | "contain",
                                }}
                              />
                              {available && design.itemAction === "cutout" && (
                                <span
                                  className="website-order-item-add"
                                  aria-hidden="true"
                                >
                                  +
                                </span>
                              )}
                            </span>
                          )}
                      </button>
                      {discovery(
                        String(group.id),
                        itemIndex + 1,
                        group.items.length,
                      )}
                    </Fragment>
                  );
                })}
              </div>
              {discovery(String(group.id), "after")}
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
