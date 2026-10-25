import { MenuCategory } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { useMenuLanguage } from "@/lib/menu-language";
import { tField } from "@/lib/translations";
import { roleTextStyle } from "@/lib/themes/typography";
import { OrderMenuToolbar } from "./OrderMenuToolbar";
import clsx from "clsx";
import { CSSProperties, useRef, useState } from "react";
import { useStuck } from "@/lib/useStickyChrome";
import { useOrderCategoryScroll } from "@/lib/useOrderCategoryScroll";
import { websiteOrderCopy } from "@/lib/websiteOrder";

// Typography-role binding for the category-bar tabs. Base = the .category-tab
// class (text-base / font-medium), preserved when the owner sets no override.
const CATEGORY_TAB_STYLE = roleTextStyle("categoryBar", "1rem", "body", 500, "none", "var(--cat-current-text)");

type CategoryBarStyle = CSSProperties & Record<`--${string}`, string>;

/**
 * Resolves the category bar's single branded palette. Legacy sticky overrides
 * win so existing restaurants keep the palette they previously chose for the
 * pinned state, but the palette no longer changes while the customer scrolls.
 */
export function categoryBarStyle(_stuck: boolean): CategoryBarStyle {
  const background =
    "var(--cat-sticky-bg, var(--cat-bg, var(--brand-dark)))";
  const text =
    "var(--cat-sticky-text, var(--cat-text, var(--ink-on-accent)))";
  const divider =
    "var(--cat-sticky-divider, var(--cat-divider, color-mix(in srgb, var(--cat-current-text) 20%, transparent)))";
  return {
    backgroundColor: background,
    color: text,
    borderColor: divider,
    "--cat-current-bg": background,
    "--cat-current-text": text,
    "--cat-current-accent":
      "var(--cat-sticky-accent, var(--cat-accent, var(--cat-current-text)))",
    "--cat-current-active-bg":
      "var(--cat-sticky-active-bg, var(--cat-active-bg, var(--cat-current-text)))",
    "--cat-current-active-text":
      "var(--cat-sticky-active-text, var(--cat-active-text, var(--cat-current-bg)))",
    "--cat-current-search-bg":
      "var(--cat-sticky-search-bg, var(--cat-search-bg, color-mix(in srgb, var(--cat-current-text) 12%, transparent)))",
    "--cat-current-search-text":
      "var(--cat-sticky-search-text, var(--cat-search-text, var(--cat-current-text)))",
    "--cat-current-icon-bg":
      "var(--cat-sticky-icon-bg, var(--cat-icon-bg, var(--cat-current-text)))",
    "--cat-current-icon":
      "var(--cat-sticky-icon, var(--cat-icon, var(--cat-current-bg)))",
    "--cat-current-cart-bg":
      "var(--cat-sticky-cart-bg, var(--cat-cart-bg, var(--cat-current-text)))",
    "--cat-current-cart-text":
      "var(--cat-sticky-cart-text, var(--cat-cart-text, var(--cat-current-bg)))",
  };
}

/** Selects auto scrolling when reduced motion is requested. */
export function categoryScrollBehavior(
  prefersReducedMotion: boolean,
): ScrollBehavior {
  return prefersReducedMotion ? "auto" : "smooth";
}

type Props = {
  groups: MenuCategory[];
  activeId?: string;
  onSelect: (id: string) => void;
  onSearch?: (query: string) => void;
  restaurantName?: string;
  backHref?: string;
  /** Pinned state, when an ancestor owns the pinning (the order page stacks this
   *  bar with the carte tabs inside one sticky host, so only that host knows).
   *  Left out, the bar pins itself at the viewport top and detects its own. */
  stuck?: boolean;
};

export function GroupTabs({
  groups,
  activeId,
  onSelect,
  onSearch,
  restaurantName,
  backHref,
  stuck: stuckOverride,
}: Props) {
  const { locale, t, direction } = useI18n();
  const { menuLocale } = useMenuLanguage();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const barRef = useRef<HTMLDivElement>(null);
  // Wolt-style stuck detection: at rest the bar shares the page background;
  // once it pins below the viewport top it gets its own surface + divider.
  const { stuck: selfStuck } = useStuck(barRef);
  const stuck = stuckOverride ?? selfStuck;

  useOrderCategoryScroll(scrollRef, activeId, groups.map((group) => group.id).join("|"), direction);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    onSearch?.(value);
  };

  // Group icons/emojis mapping
  const groupEmojis: Record<string, string> = {
    burgers: "🍔",
    hamburgers: "🍔",
    המבורגרים: "🍔",
    sides: "🍟",
    קטנות: "🍟",
    drinks: "🥤",
    שתייה: "🥤",
    desserts: "🍰",
    קינוחים: "🍰",
    salads: "🥗",
    סלטים: "🥗",
    pizza: "🍕",
    פיצה: "🍕",
    kids: "👶",
    ילדים: "👶",
    extras: "🍿",
    תוספות: "🍿",
    wraps: "🌯",
    טורטיות: "🌯",
  };

  const getGroupEmoji = (name: string) => {
    const lowercaseName = name.toLowerCase();
    for (const [key, emoji] of Object.entries(groupEmojis)) {
      if (lowercaseName.includes(key)) {
        return emoji;
      }
    }
    return null;
  };

  // Pinning belongs to whoever knows the full stack. Standalone, that's this bar
  // itself, parked under the navbar's measured height (0 when the owner's
  // navigation mode makes it float away, so no dead band is ever reserved).
  const selfPinned = stuckOverride === undefined;

  return (
    <div
      ref={barRef}
      data-category-bar-state={stuck ? "sticky" : "normal"}
      className={clsx(
        "order-menu-chrome z-40 border-b transition-colors duration-200 motion-reduce:transition-none",
        selfPinned && "sticky",
        stuck && "shadow-[0_8px_24px_rgba(0,0,0,0.12)]",
      )}
      style={{
        ...categoryBarStyle(stuck),
        backgroundColor: "var(--order-menu-chrome-surface, var(--cat-current-bg))",
        ...(selfPinned ? { top: "var(--nav-sticky-h, 0px)" } : null),
      }}
    >
      <OrderMenuToolbar backHref={backHref} restaurantName={restaurantName} search={onSearch ? {
        value: searchQuery,
        onChange: handleSearch,
        label: t("searchMenu"),
        placeholder: websiteOrderCopy(locale).search,
      } : undefined} />

      <div className="order-menu-category-row flex items-center gap-3 px-4 md:px-6 lg:px-12">
        <div
          ref={scrollRef}
          className="order-menu-categories flex-1 flex items-center overflow-x-auto scroll-smooth scrollbar-hide motion-reduce:scroll-auto"
          dir={direction}
        >
          <div className="order-menu-category-links">
          {groups.map((g) => {
            const groupName = tField(g, "name", menuLocale);
            const active = activeId === g.id;
            // Match emoji on either the source name or the localized one so the
            // emoji map keeps working regardless of which language the owner
            // typed in.
            const emoji = getGroupEmoji(g.name) ?? getGroupEmoji(groupName);
            return (
              <button
                key={g.id}
                onClick={() => onSelect(g.id)}
                style={{
                  ...CATEGORY_TAB_STYLE,
                  fontSize: `var(--order-category-font-size, ${CATEGORY_TAB_STYLE.fontSize})`,
                  fontWeight: `var(--order-category-font-weight, ${CATEGORY_TAB_STYLE.fontWeight})`,
                  color: active ? "var(--order-category-active-text, var(--cat-current-active-text))" : `var(--order-category-text, ${CATEGORY_TAB_STYLE.color})`,
                }}
                aria-current={active ? "location" : undefined}
                className={clsx(
                  "category-tab flex items-center gap-1.5",
                  active && "active"
                )}
              >
                {emoji && <span>{emoji}</span>}
                <span>{groupName}</span>
              </button>
            );
          })}
          </div>
        </div>

      </div>
    </div>
  );
}

/** @deprecated Use GroupTabs instead */
export const CategoryTabs = GroupTabs;
