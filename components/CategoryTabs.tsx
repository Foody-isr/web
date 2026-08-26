import { MenuCategory } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { useMenuLanguage } from "@/lib/menu-language";
import { tField } from "@/lib/translations";
import { roleTextStyle } from "@/lib/themes/typography";
import clsx from "clsx";
import { CSSProperties, ReactNode, useEffect, useRef, useState } from "react";
import { useStuck } from "@/lib/useStickyChrome";

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
  /** Desktop-only order controls that join the bar once it is pinned. */
  stickyLeading?: ReactNode;
  stickyActions?: ReactNode;
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
  stickyLeading,
  stickyActions,
  stuck: stuckOverride,
}: Props) {
  const { t, direction } = useI18n();
  const { menuLocale } = useMenuLanguage();
  const scrollRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [searchQuery, setSearchQuery] = useState("");
  const barRef = useRef<HTMLDivElement>(null);
  // Wolt-style stuck detection: at rest the bar shares the page background;
  // once it pins below the viewport top it gets its own surface + divider.
  const { stuck: selfStuck } = useStuck(barRef);
  const stuck = stuckOverride ?? selfStuck;

  // Auto-scroll the active group button into view
  useEffect(() => {
    if (!activeId) return;

    const button = buttonRefs.current.get(activeId);
    const container = scrollRef.current;

    if (button && container) {
      const containerRect = container.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();

      if (buttonRect.left < containerRect.left || buttonRect.right > containerRect.right) {
        const prefersReducedMotion = window.matchMedia?.(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        button.scrollIntoView({
          behavior: categoryScrollBehavior(prefersReducedMotion),
          block: "nearest",
          inline: "center"
        });
      }
    }
  }, [activeId]);

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

  const SearchInput = ({ className }: { className?: string }) => (
    <div className={clsx("search-input category-search-input", className)}>
      <svg
        className="w-4 h-4 flex-shrink-0 opacity-70"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder={
          restaurantName
            ? `${t("searchIn") || "Search in"} ${restaurantName}...`
            : t("searchMenu") || "Search menu..."
        }
        className="bg-transparent outline-none flex-1 text-sm min-w-0"
      />
      {searchQuery && (
        <button
          onClick={() => handleSearch("")}
          className="flex-shrink-0 opacity-70 transition-opacity hover:opacity-100"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );

  // Pinning belongs to whoever knows the full stack. Standalone, that's this bar
  // itself, parked under the navbar's measured height (0 when the owner's
  // navigation mode makes it float away, so no dead band is ever reserved).
  const selfPinned = stuckOverride === undefined;

  return (
    <div
      ref={barRef}
      data-category-bar-state={stuck ? "sticky" : "normal"}
      className={clsx(
        "z-40 border-b transition-colors duration-200 motion-reduce:transition-none",
        selfPinned && "sticky",
        stuck && "shadow-[0_8px_24px_rgba(0,0,0,0.12)]",
      )}
      style={{
        ...categoryBarStyle(stuck),
        ...(selfPinned ? { top: "var(--nav-sticky-h, 0px)" } : null),
      }}
    >
      {onSearch && (
        <div className="block md:hidden px-4 pt-4 pb-1">
          <SearchInput className="w-full" />
        </div>
      )}

      <div className="flex items-center gap-3 px-4 md:px-6 lg:px-12">
        {stuck && stickyLeading ? (
          <div className="hidden shrink-0 items-center gap-2 md:flex">
            {stickyLeading}
          </div>
        ) : null}
        <div
          ref={scrollRef}
          className="flex-1 flex items-center gap-1.5 overflow-x-auto scroll-smooth scrollbar-hide motion-reduce:scroll-auto"
          dir={direction}
        >
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
                ref={(el) => { if (el) buttonRefs.current.set(g.id, el); }}
                onClick={() => onSelect(g.id)}
                style={{
                  ...CATEGORY_TAB_STYLE,
                  ...(active ? { color: "var(--cat-current-bg)" } : null),
                }}
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

        {onSearch && (
          <div className="hidden md:block flex-shrink-0">
            <SearchInput className="w-52 xl:w-72" />
          </div>
        )}
        {stuck && stickyActions ? (
          <div className="hidden shrink-0 items-center gap-2 md:flex">
            {stickyActions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** @deprecated Use GroupTabs instead */
export const CategoryTabs = GroupTabs;
