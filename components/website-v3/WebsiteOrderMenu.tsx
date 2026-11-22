"use client";
import { FramedImage, FramedBackground } from "./FramedImage";
import { useResolvedTheme } from "@/lib/themes/useResolvedTheme";
import {
  resolveSiteColorStyle,
  resolveSiteMenuColors,
  siteColorReference,
  siteMenuColorReference,
  sectionSiteColorId,
} from "@/lib/siteColors";
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
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
import { useMobileTabState } from "@/components/mobile-experience/MobileTabPages";
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
  websiteOrderBranches,
  websiteOrderMenus,
  websiteItemAvailable,
  websiteOrderCopy,
  type WebsiteOrderDesign,
} from "@/lib/websiteOrder";

const anchor = (menu: MenuData, groupId?: string) =>
  `menu-${menu.entryKey}${groupId ? `-${groupId}` : ""}`;

/** The editable storefront catalogue shares existing item/cart behavior and public menu membership. */
export function WebsiteOrderMenu({
  menus,
  design,
  onSelect,
  restaurant,
  sections = [],
  activeEntryKey,
  onSelectMenu,
  comboSelection,
  comboBottomInset = 0,
  showBack = false,
  languageInMenu = false,
  notice,
}: {
  menus: MenuData[];
  restaurant?: Restaurant;
  sections?: WebsiteSection[];
  design: WebsiteOrderDesign;
  onSelect: (item: MenuItem) => void;
  activeEntryKey?: string | null;
  onSelectMenu?: (entryKey: string) => void;
  comboSelection?: {
    stepKey: string;
    eligibleIds: Set<string>;
    soldOutIds: Set<string>;
    picksByItem: Map<string, number>;
    onRemove: (item: MenuItem) => void;
  };
  comboBottomInset?: number;
  showBack?: boolean;
  languageInMenu?: boolean;
  notice?: React.ReactNode;
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
  const [query, setQuery] = useMobileTabState("menu-search", "");
  const [availableOnly, setAvailableOnly] = useMobileTabState("available-menu-items", false);
  const imageAspectRatio = { square: "1", landscape: "4 / 3", wide: "3 / 2", portrait: "3 / 4" }[design.imageRatio];
  const root = useRef<HTMLElement>(null);
  const navigation = useRef<HTMLDivElement>(null);
  const categoryLinks = useRef<HTMLElement>(null);
  const subgroupLinks = useRef<HTMLElement>(null);
  const tabsId = useId();
  const navigationHeight = useElementHeight(navigation);
  const [activeAnchor, setActiveAnchor] = useState("");
  const [selectedSubgroups, setSelectedSubgroups] = useState<Record<string, string>>({});
  const [jump, setJump] = useState<{ id: string } | null>(null);
  const scrollSelection = useRef<{ id: string; y?: number } | null>(null);
  const entries = useMemo(() => websiteOrderMenus(menus), [menus]);
  const [selectedEntryKey, setSelectedEntryKey] = useState(entries[0]?.entryKey);
  const activeMenu =
    entries.find((menu) => menu.entryKey === (activeEntryKey ?? selectedEntryKey)) ?? entries[0];
  const menu = useMemo(
    () => websiteOrderMenus(menus, query, availableOnly).find(
      (menu) => menu.entryKey === activeMenu?.entryKey,
    ),
    [menus, query, availableOnly, activeMenu?.entryKey],
  );
  const allBranches = useMemo(() => websiteOrderBranches(activeMenu?.groups ?? []), [activeMenu]);
  const branches = useMemo(() => websiteOrderBranches(menu?.groups ?? []), [menu]);
  const mainLinks = menu ? branches.map((branch) => ({ ...branch, id: anchor(menu, branch.group.id) })) : [];
  const activeBranch = mainLinks.find(({ id }) => id === activeAnchor) ?? mainLinks[0];
  const showAllGroups = !design.showCategories || !!query.trim();
  const subgroupOptions = !showAllGroups && activeBranch?.sections.some(({ path }) => path.length)
    ? activeBranch.sections : [];
  const selectedSubgroup = (id: string, sections: (typeof branches)[number]["sections"]) =>
    sections.find(({ group }) => group.id === selectedSubgroups[id]) ?? sections[0];
  const activeSubgroup = activeBranch && selectedSubgroup(activeBranch.id, subgroupOptions)?.group.id;
  const subgroupLinkIds = subgroupOptions.map(({ group }) => group.id).join("|");
  const hasSubgroups = allBranches.some(({ sections }) => sections.some(({ path }) => path.length));
  const multipleMenus = entries.length > 1;
  useEffect(() => {
    if (activeMenu && activeEntryKey != null && activeMenu.entryKey !== activeEntryKey) {
      onSelectMenu?.(activeMenu.entryKey);
    }
  }, [activeMenu, activeEntryKey, onSelectMenu]);
  const selectMenu = (entryKey: string) => {
    setSelectedEntryKey(entryKey);
    onSelectMenu?.(entryKey);
    setQuery("");
    setActiveAnchor("");
    scrollSelection.current = null;
  };
  const jumpToGroup = useCallback((id: string) => {
    scrollSelection.current = { id };
    setJump({ id });
    setActiveAnchor(id);
  }, []);
  useEffect(() => {
    if (!jump) return;
    const frame = requestAnimationFrame(() => {
      const target = root.current?.querySelector<HTMLElement>(`#${CSS.escape(jump.id)}`);
      if (target) {
        const bar = navigation.current;
        if (design.stickyCategories && bar) {
          const offset = (parseFloat(getComputedStyle(bar).top) || 0) + bar.offsetHeight + 23;
          window.scrollTo({ top: window.scrollY + target.getBoundingClientRect().top - offset, behavior: "instant" });
        } else {
          target.scrollIntoView({ block: "start", behavior: "instant" });
        }
        scrollSelection.current = { id: jump.id, y: window.scrollY };
      } else {
        scrollSelection.current = null;
      }
      setJump(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [jump, design.stickyCategories]);

  useEffect(() => {
    if (!activeMenu || !hasSubgroups) return;
    const restoreAnchor = () => {
      const hash = window.location.hash.slice(1);
      const branch = allBranches.find(({ group, sections }) =>
        anchor(activeMenu, group.id) === hash || sections.some((section) => anchor(activeMenu, section.group.id) === hash),
      );
      if (!branch) return;
      const rootId = anchor(activeMenu, branch.group.id);
      const target = branch.sections.find(({ group }) => anchor(activeMenu, group.id) === hash);
      if (target) setSelectedSubgroups((previous) => ({ ...previous, [rootId]: target.group.id }));
      jumpToGroup(rootId);
    };
    restoreAnchor();
    window.addEventListener("hashchange", restoreAnchor);
    return () => window.removeEventListener("hashchange", restoreAnchor);
  }, [activeMenu, allBranches, hasSubgroups, jumpToGroup]);
  const placements = orderDiscoverySections(sections).map((section) => ({
    section,
    placement: orderDiscoveryPlacement(
      section,
      menu?.groups.filter(({ items }) => items.length).map(({ id }) => id) ?? [],
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
  // Keep this renderer mounted throughout composition. Reveal the next step in
  // the current carte using its real group anchors and measured sticky offset.
  const comboStepKey = comboSelection?.stepKey;
  const comboEligibleIds = comboSelection?.eligibleIds;
  useEffect(() => {
    if (!comboStepKey || !comboEligibleIds || !activeMenu) return;
    setQuery("");
    setAvailableOnly(false);
    let bestCount = 0;
    let best: { root: string; group: string } | undefined;
    for (const branch of allBranches) {
      for (const { group } of branch.sections) {
        const count = group.items.filter((item) => comboEligibleIds.has(item.id)).length;
        if (count > bestCount) {
          bestCount = count;
          best = { root: anchor(activeMenu, branch.group.id), group: group.id };
        }
      }
    }
    if (best) {
      const { root, group } = best;
      setSelectedSubgroups((previous) => ({ ...previous, [root]: group }));
      jumpToGroup(root);
    }
  }, [comboStepKey, comboEligibleIds, activeMenu, allBranches, setQuery, setAvailableOnly, jumpToGroup]);
  const anchorIds = mainLinks.map((link) => link.id).join("|");
  useEffect(() => {
    const targets = Array.from(
      root.current?.querySelectorAll<HTMLElement>("[data-order-anchor]") ?? [],
    );
    let frame = 0;
    const update = () => {
      const selected = scrollSelection.current;
      if (selected && targets.some(({ id }) => id === selected.id) &&
          (selected.y == null || Math.abs(window.scrollY - selected.y) < 2)) return;
      scrollSelection.current = null;
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
  useOrderCategoryScroll(categoryLinks, activeBranch?.id, anchorIds, direction);
  useOrderCategoryScroll(subgroupLinks, activeSubgroup, subgroupLinkIds, direction);
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
  const sharedColorStyle = resolveSiteColorStyle(config?.customPalette, colorStyle);
  const sharedStyle = woltColors || !!sharedColorStyle;
  const flatCategories = design.categoryShape === "plain" || design.categoryShape === "underline";
  const flatActiveText = !woltColors && sharedColorStyle && flatCategories
    ? resolveSiteMenuColors(sharedColorStyle, false).active_text
    : undefined;
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
      data-combo-mode={comboSelection ? true : undefined}
      data-columns={design.layout === "single" ? 1 : design.columns}
      style={
        {
          paddingBottom: comboSelection ? comboBottomInset + 24 : undefined,
          "--order-category-gap": `${design.categoryGap}px`,
          "--order-category-spacing": `${design.categorySpacing}px`,
          "--order-category-scroll-offset": design.stickyCategories
            ? `calc(var(--website-order-sticky-top) + ${navigationHeight}px + 24px)`
            : "max(96px, calc(var(--website-order-sticky-top) + 24px))",
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
                  flatCategories
                    ? "transparent"
                    : "var(--text)",
                "--order-category-active-text":
                  flatCategories
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
        data-multiple-menus={multipleMenus}
        data-hierarchy={(design.showCategories && hasSubgroups) || undefined}
        data-color-style={sharedStyle ? colorStyle : undefined}
        style={
          {
            ...(sharedStyle ? orderNavigationColorVariables() : design.cardStyle === "filled" ? categoryBarStyle(false) : {}),
            ...(flatActiveText ? { "--site-menu-active-text": flatActiveText } : {}),
            ...(woltColors ? {
              "--order-menu-chrome-surface": "var(--site-menu-bar-background)",
              "--order-menu-control-bg": "#333333",
            } : {}),
            backgroundColor: "var(--order-menu-chrome-surface, var(--cat-current-bg, var(--order-filter-background)))",
          } as CSSProperties
        }
      >
        {multipleMenus && (
          <div
            className="website-order-menu-tabs"
            style={sharedStyle ? { color: "var(--site-menu-menu-text)" } : undefined}
            role="tablist"
            aria-label={t("menu")}
            dir={direction}
            onKeyDown={(event) => {
              const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
              const index = tabs.indexOf(event.target as HTMLButtonElement);
              if (index < 0) return;
              let next = index;
              if (event.key === "Home") next = 0;
              else if (event.key === "End") next = entries.length - 1;
              else if (event.key === "ArrowRight") next += direction === "rtl" ? -1 : 1;
              else if (event.key === "ArrowLeft") next += direction === "rtl" ? 1 : -1;
              else return;
              event.preventDefault();
              next = (next + entries.length) % entries.length;
              selectMenu(entries[next].entryKey);
              tabs[next]?.focus();
            }}
          >
            {entries.map((menu) => (
              <button
                key={menu.entryKey}
                type="button"
                role="tab"
                id={`${tabsId}-tab-${menu.entryKey}`}
                aria-controls={`${tabsId}-panel`}
                aria-selected={menu.entryKey === activeMenu?.entryKey}
                tabIndex={menu.entryKey === activeMenu?.entryKey ? 0 : -1}
                onClick={() => selectMenu(menu.entryKey)}
              >
                {menu.name}
              </button>
            ))}
          </div>
        )}
        <OrderMenuToolbar
          backHref={restaurant && showBack ? `/r/${encodeURIComponent(restaurant.slug || String(restaurant.id))}` : undefined}
          hideLanguage={languageInMenu}
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
              {mainLinks.map((link) => (
                <a
                  key={link.id}
                  href={`#${link.id}`}
                  aria-current={activeBranch?.id === link.id ? "location" : undefined}
                  onClick={(event) => {
                    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                    if (hasSubgroups) {
                      event.preventDefault();
                      const hash = `#${link.id}`;
                      if (window.location.hash !== hash) window.history.pushState(null, "", hash);
                      jumpToGroup(link.id);
                    } else {
                      setActiveAnchor(link.id);
                    }
                  }}
                >
                  {tField(link.group, "name", menuLocale)}
                </a>
              ))}
            </div>
          </nav>
        )}
        {menu && activeBranch && subgroupOptions.length > 0 && (
          <nav
            ref={subgroupLinks}
            className="website-order-subgroups"
            dir={direction}
            aria-label={copy.subcategories.replace("{group}", tField(activeBranch.group, "name", menuLocale))}
          >
            <div className="website-order-subgroup-links">
              {subgroupOptions.map(({ group, path }) => (
                <button
                  key={group.id}
                  type="button"
                  aria-pressed={group.id === activeSubgroup}
                  onClick={() => {
                    setSelectedSubgroups((previous) => ({ ...previous, [activeBranch.id]: group.id }));
                    jumpToGroup(activeBranch.id);
                  }}
                >
                  {(path.length ? path : [group]).map((entry) => tField(entry, "name", menuLocale)).join(" / ")}
                </button>
              ))}
            </div>
          </nav>
        )}
      </div>
      <div
        id={`${tabsId}-panel`}
        role={multipleMenus ? "tabpanel" : undefined}
        aria-labelledby={multipleMenus ? `${tabsId}-tab-${activeMenu?.entryKey}` : undefined}
        tabIndex={multipleMenus ? 0 : undefined}
      >
      {notice}
      {!menu && (
        <p className="py-16 text-center">{copy.noResults}</p>
      )}
      {menu && (
        <div
          key={menu.entryKey}
          id={anchor(menu)}
          className="website-order-menu-group"
        >
          {branches.map(({ group: parent, sections }) => {
            const id = anchor(menu, parent.id);
            const shown = showAllGroups ? sections : [selectedSubgroup(id, sections)];
            return (
              <div key={parent.id} id={id} data-order-anchor className="website-order-branch">
              {shown.map(({ group }) => (
            <div
              key={group.id}
              id={group.id === parent.id ? undefined : anchor(menu, group.id)}
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
              <div className="website-order-items" data-layout={design.layout} data-mobile-layout={!comboSelection && design.mobileItemLayout === "carousel" ? "carousel" : undefined}>
                {group.items.map((item, itemIndex) => {
                  const price = itemDisplayPriceRange(item);
                  const available = websiteItemAvailable(item);
                  const eligible = comboSelection?.eligibleIds.has(item.id) ?? false;
                  const comboSoldOut = comboSelection?.soldOutIds.has(item.id) ?? false;
                  const count = comboSelection?.picksByItem.get(item.id) ?? 0;
                  const portion = deriveItemPortion(item, menuLocale).label;
                  return (
                    <Fragment key={item.id}>
                      <div className="website-order-choice" data-combo-picked={count > 0 ? true : undefined}>
                      <button
                        aria-label={tField(item, "name", menuLocale)}
                        onClick={() => onSelect(item)}
                        disabled={!available || (!!comboSelection && (!eligible || comboSoldOut))}
                        aria-pressed={comboSelection && eligible ? count > 0 : undefined}
                        data-combo-item-id={comboSelection ? item.id : undefined}
                        data-combo-picked={count > 0 ? true : undefined}
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
                            {(comboSoldOut || (design.showBadges && !available)) && (
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
                              {available && design.itemAction !== "none" && (
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
                      {comboSelection && count > 0 && (
                        <div className="website-order-combo-count">
                          <button type="button" onClick={() => comboSelection.onRemove(item)} aria-label={`${t("decreaseQuantity")} · ${tField(item, "name", menuLocale)}`}>−</button>
                          <span aria-live="polite">×{count}</span>
                        </div>
                      )}
                      </div>
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
            );
          })}
        </div>
      )}
      </div>
    </section>
  );
}
