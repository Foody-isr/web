"use client";
import { Fragment, useMemo, useState, type CSSProperties } from "react";
import type { MenuData, MenuItem, Restaurant, WebsiteSection } from "@/lib/types";
import { OrderDiscoveryRail } from "@/components/OrderDiscoveryRail";
import { orderDiscoveryPlacement, orderDiscoverySections } from "@/lib/orderDiscovery";
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
  const { locale, t } = useI18n();
  const { menuLocale } = useMenuLanguage();
  const { money } = useCurrency();
  const copy = websiteOrderCopy(locale);
  const [query, setQuery] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const visible = useMemo(
    () => websiteOrderMenus(menus, query, availableOnly),
    [menus, query, availableOnly],
  );
  const placements = orderDiscoverySections(sections).map((section) => ({ section,
    placement: orderDiscoveryPlacement(section, visible.flatMap((menu) => menu.groups.map((group) => String(group.id)))),
  }));
  const discovery = (groupId: string, edge: "before" | "after" | number, count = 0) => restaurant && placements
    .filter(({ placement }) => placement.groupId === groupId && (typeof edge === "number"
      ? placement.mode === "inside_group" && edge === Math.min(placement.insertAfterItems, count)
      : placement.mode === "between_groups" && placement.edge === edge))
    .map(({ section }) => <OrderDiscoveryRail key={section.id} section={section} restaurant={restaurant} desktopGap="regular" />);
  const anchor = (menu: MenuData, groupId?: string) =>
    `menu-${menu.entryKey}${groupId ? `-${groupId}` : ""}`;
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
  const [background, foreground] = colors[design.colorStyle];
  const backgroundImage =
    design.backgroundKind === "image" && design.backgroundImage
      ? `url(${JSON.stringify(design.backgroundImage)})`
      : design.backgroundKind === "gradient"
        ? `linear-gradient(135deg, ${design.background ?? "#ffffff"}, ${design.backgroundEnd})`
        : undefined;
  const textStyle = (
    text: WebsiteOrderDesign["itemTitleText"],
  ): CSSProperties => ({
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
    fontWeight: text.style.startsWith("title") ? 600 : 400,
    textAlign: text.alignment,
    textTransform: text.caps ? "uppercase" : "none",
  });
  return (
    <section
      data-editor-region="order-items"
      className="website-order-menu"
      style={
        {
          backgroundColor:
            design.backgroundKind === "color" ? design.background : background,
          color: foreground,
          backgroundImage,
          backgroundSize: "cover",
          backgroundPosition: "center",
          "--website-order-columns":
            design.layout === "single" ? 1 : design.columns,
        } as CSSProperties
      }
    >
      <div className="website-order-tools">
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
        <div className="website-order-navigation">
          {design.showSearch && (
            <button
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
          {searchOpen && design.showSearch && (
            <input
              autoFocus
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
                ...textStyle(design.categoryText),
                justifyContent:
                  design.categoryAlignment === "center"
                    ? "center"
                    : design.categoryAlignment === "end"
                      ? "flex-end"
                      : "flex-start",
              }}
            >
              {visible.map((menu) => (
                <div key={menu.entryKey}>
                  <a href={`#${anchor(menu)}`}>{menu.name}</a>
                  {menu.groups.map((group) => (
                    <a
                      key={group.id}
                      href={`#${anchor(menu, String(group.id))}`}
                    >
                      {tField(group, "name", menuLocale)}
                    </a>
                  ))}
                </div>
              ))}
            </nav>
          )}
        </div>
      </div>
      {visible.length === 0 && (
        <p className="py-16 text-center">{copy.noResults}</p>
      )}
      {visible.map((menu) => (
        <div
          key={menu.entryKey}
          id={anchor(menu)}
          className="website-order-menu-group"
        >
          <h2>{menu.name}</h2>
          {menu.groups.map((group) => (
            <div
              key={group.id}
              id={anchor(menu, String(group.id))}
              className="website-order-category"
            >
              {discovery(String(group.id), "before")}
              {design.showCategoryTitles && (
                <h3 style={textStyle(design.categoryTitleText)}>
                  {tField(group, "name", menuLocale)}
                </h3>
              )}
              <div className="website-order-items" data-layout={design.layout}>
                {group.items.map((item, itemIndex) => {
                  const price = itemDisplayPriceRange(item);
                  const available = websiteItemAvailable(item);
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
                    >
                      <span className="website-order-item-copy">
                        {design.showItemTitles && (
                          <strong style={textStyle(design.itemTitleText)}>
                            {tField(item, "name", menuLocale)}
                          </strong>
                        )}
                        {design.showDescriptions && item.description && (
                          <span className="website-order-item-description">
                            {tField(item, "description", menuLocale)}
                          </span>
                        )}
                        {design.showPrices && (
                          <span style={textStyle(design.itemPriceText)}>
                            {isByWeight(item)
                              ? money(weightEstimatePrice(item))
                              : price.min === price.max
                                ? money(price.min)
                                : `${money(price.min)} – ${money(price.max)}`}
                          </span>
                        )}
                        {design.showBadges && !available && (
                          <small>{t("soldOut")}</small>
                        )}
                      </span>
                      {design.showImages &&
                        item.imageUrl &&
                        design.layout !== "text" &&
                        design.layout !== "single" && (
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
                              objectFit: design.imageFit as "cover" | "contain",
                            }}
                          />
                        )}
                    </button>
                    {discovery(String(group.id), itemIndex + 1, group.items.length)}
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
