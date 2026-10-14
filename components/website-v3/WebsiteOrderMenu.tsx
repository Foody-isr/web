"use client";
import { FramedImage, FramedBackground } from "./FramedImage";
import { useResolvedTheme } from "@/lib/themes/useResolvedTheme";
import {
  resolveSiteColorStyle,
  siteColorReference,
  siteMenuColorReference,
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
  woltOrderColorVariables,
} from "@/lib/websiteOrderColors";
import { categoryBarStyle } from "@/components/CategoryTabs";
import { OrderMenuToolbar } from "@/components/OrderMenuToolbar";
import { useElementHeight } from "@/lib/useStickyChrome";
import { useOrderCategoryScroll } from "@/lib/useOrderCategoryScroll";
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
}: {
  menus: MenuData[];
  restaurant?: Restaurant;
  sections?: WebsiteSection[];
  design: WebsiteOrderDesign;
  onSelect: (item: MenuItem) => void;
}) {
  const { locale, t, direction } = useI18n();
  const { menuLocale } = useMenuLanguage();
  const { money } = useCurrency();
  const copy = websiteOrderCopy(locale);
  const { config } = useResolvedTheme();
  const colorStyle = sectionSiteColorId(
    config?.customPalette,
    design.colorStyle,
  );
  const [query, setQuery] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const imageAspectRatio = { square: "1", landscape: "4 / 3", wide: "3 / 2", portrait: "3 / 4" }[design.imageRatio];
  const root = useRef<HTMLElement>(null);
  const navigation = useRef<HTMLDivElement>(null);
  const categoryLinks = useRef<HTMLElement>(null);
  const navigationHeight = useElementHeight(navigation);
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
  }, [anchorIds, design.stickyCategories, navigationHeight]);
  useOrderCategoryScroll(categoryLinks, activeAnchor, anchorIds, direction);
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
  const woltColors = design.colorPreset === "wolt";
  const sharedStyle = woltColors || !!resolveSiteColorStyle(config?.customPalette, colorStyle);
  const [background, foreground] = colors[colorStyle] || colors.default;
  const backgroundImage =
    design.backgroundKind === "image" && design.backgroundImage
      ? `url(${JSON.stringify(design.backgroundImage)})`
      : !sharedStyle && design.backgroundKind === "gradient"
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
            role === "itemName" || role === "itemPrice" ? 700 : role === "itemDescription" ? 400 : 500,
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
      data-layout={design.layout}
      data-color-preset={design.colorPreset}
      data-card-style={design.cardStyle}
      data-columns={design.layout === "single" ? 1 : design.columns}
      style={
        {
          "--order-category-gap": `${design.categoryGap}px`,
          "--order-category-spacing": `${design.categorySpacing}px`,
          "--order-category-scroll-offset": design.stickyCategories
            ? `calc(var(--nav-sticky-h, 0px) + ${navigationHeight}px + 24px)`
            : "96px",
          ...(sharedStyle
            ? {
                ...siteColorReference(colorStyle),
                ...siteMenuColorReference(colorStyle),
                ...(woltColors ? woltOrderColorVariables() : {}),
                "--cat-heading": "var(--site-menu-heading)",
                "--type-categorytitle-color": "var(--site-menu-heading)",
              }
            : {}),
          backgroundColor:
            sharedStyle
              ? "var(--site-menu-background)"
              : design.backgroundKind === "color" ? design.background : background,
          "--order-filter-background": sharedStyle
            ? "var(--site-menu-background)"
            : design.backgroundKind === "color" ? design.background : background,
          color: woltColors ? "#ffffff" : sharedStyle
            ? "var(--site-paragraph, var(--text))"
            : foreground,
          isolation: "isolate",
          backgroundImage: design.backgroundImageFraming ? undefined : backgroundImage,
          backgroundSize: "cover",
          backgroundPosition: "center",
          "--website-order-columns":
            design.layout === "single" ? 1 : design.columns,
          "--order-item-spacing": design.itemSpacing == null ? undefined : `${design.itemSpacing}px`,
          "--order-row-padding": design.rowPadding == null ? undefined : `${design.rowPadding}px`,
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
                  ["plain", "underline"].includes(design.categoryShape)
                    ? "transparent"
                    : "var(--text)",
                "--order-category-active-text":
                  ["plain", "underline"].includes(design.categoryShape)
                    ? "inherit"
                    : "var(--brand-dark, var(--surface))",
              }),
        } as CSSProperties
      }
    >
      {design.backgroundKind === "image" && design.backgroundImage && <FramedBackground src={design.backgroundImage} framing={design.backgroundImageFraming} />}
      <div className="website-order-tools">
        {design.showAvailabilityFilter && (
          <div className="website-availability-filter">
            <select
              aria-label={copy.availabilityFilter}
              value={availableOnly ? "available" : "all"}
              onChange={(event) =>
                setAvailableOnly(event.target.value === "available")
              }
            >
              <option value="all">{copy.all}</option>
              <option value="available">{copy.available}</option>
            </select>
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
              <path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>
      <div
        ref={navigation}
        className="website-order-navigation order-menu-chrome"
        data-sticky={design.stickyCategories}
        data-shape={design.categoryShape}
        data-color-style={sharedStyle ? colorStyle : undefined}
        style={
          {
            ...(sharedStyle ? orderNavigationColorVariables() : design.cardStyle === "filled" ? categoryBarStyle(false) : {}),
            ...(woltColors ? {
              "--order-menu-chrome-surface": "var(--site-menu-bar-background)",
              "--order-menu-control-bg": "#333333",
            } : {}),
            backgroundColor: "var(--order-menu-chrome-surface, var(--cat-current-bg, var(--order-filter-background)))",
          } as CSSProperties
        }
      >
        <OrderMenuToolbar
          backHref={restaurant ? `/r/${encodeURIComponent(restaurant.slug || String(restaurant.id))}` : undefined}
          restaurantName={restaurant?.name}
          search={design.showSearch ? { value: query, onChange: setQuery, label: copy.search, placeholder: copy.search } : undefined}
        />
        {design.showCategories && (
          <nav
            ref={categoryLinks}
            className="order-menu-categories"
            dir={direction}
            aria-label={copy.categories}
            data-caps={design.categoryCaps}
            data-background={!sharedStyle && design.categoryBackground}
            style={{
              ...textStyle(
                design.categoryText,
                "categoryBar",
                "1rem",
                "inherit",
              ),
              "--order-category-alignment":
                design.categoryAlignment === "center"
                  ? "center"
                  : design.categoryAlignment === "end"
                    ? "flex-end"
                    : "flex-start",
            } as CSSProperties}
          >
            <div className="order-menu-category-links">
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
                      sharedStyle ? "var(--site-menu-heading)" : "var(--site-title, var(--text))",
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
                        data-image-position={design.imagePosition}
                        data-image-size={design.imageSize}
                        data-price-placement={design.pricePlacement}
                        data-description-lines={design.descriptionLines}
                        data-color-style={
                          sharedStyle ? colorStyle : undefined
                        }
                        style={
                          sharedStyle
                            ? (orderCardColorVariables() as CSSProperties)
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
                                  ...textStyle(
                                    design.itemDescriptionText,
                                    "itemDescription",
                                    ".875rem",
                                    "var(--order-card-description)",
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
                              style={{ aspectRatio: imageAspectRatio }}
                            >
                              <FramedImage native fill={Boolean(design.itemImageFrames[item.id])} framing={design.itemImageFrames[item.id]}
                                src={item.imageUrl}
                                alt=""
                                loading="lazy"
                                style={{
                                  aspectRatio: imageAspectRatio,
                                  height: "100%",
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
