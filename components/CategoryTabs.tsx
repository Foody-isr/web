import { MenuCategory } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

type Props = {
  groups: MenuCategory[];
  activeId?: string;
  onSelect: (id: string) => void;
  onSearch?: (query: string) => void;
  restaurantName?: string;
};

export function GroupTabs({
  groups,
  activeId,
  onSelect,
  onSearch,
  restaurantName,
}: Props) {
  const { t, direction } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [searchQuery, setSearchQuery] = useState("");

  // Auto-scroll the active group button into view
  useEffect(() => {
    if (!activeId) return;

    const button = buttonRefs.current.get(activeId);
    const container = scrollRef.current;

    if (button && container) {
      const containerRect = container.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();

      if (buttonRect.left < containerRect.left || buttonRect.right > containerRect.right) {
        button.scrollIntoView({
          behavior: "smooth",
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
    <div className={clsx("search-input", className)}>
      <svg
        className="w-4 h-4 text-[var(--text-soft)] flex-shrink-0"
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
          className="text-[var(--text-soft)] hover:text-[var(--text)] flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );

  return (
    <div className="sticky top-0 md:top-14 z-40 bg-[var(--surface)] border-b border-[var(--divider)]">
      {onSearch && (
        <div className="block md:hidden px-4 pt-3">
          <SearchInput className="w-full" />
        </div>
      )}

      <div className="flex items-center gap-4 px-4 md:px-6 py-3">
        <div
          ref={scrollRef}
          className="flex-1 flex gap-2 overflow-x-auto scrollbar-hide"
          dir={direction}
        >
          {groups.map((g) => {
            const emoji = getGroupEmoji(g.name);
            return (
              <button
                key={g.id}
                ref={(el) => { if (el) buttonRefs.current.set(g.id, el); }}
                onClick={() => onSelect(g.id)}
                className={clsx(
                  "category-pill flex items-center gap-1.5",
                  activeId === g.id && "active"
                )}
              >
                {emoji && <span>{emoji}</span>}
                <span>{g.name}</span>
              </button>
            );
          })}
        </div>

        {onSearch && (
          <div className="hidden md:block flex-shrink-0">
            <SearchInput className="w-64" />
          </div>
        )}
      </div>
    </div>
  );
}

/** @deprecated Use GroupTabs instead */
export const CategoryTabs = GroupTabs;
