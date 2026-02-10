import { MenuCategory } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

export const POPULAR_CATEGORY_ID = "__popular__";

type Props = {
  categories: MenuCategory[];
  activeId?: string;
  onSelect: (id: string) => void;
  showPopular?: boolean;
  onSearch?: (query: string) => void;
  restaurantName?: string;
};

export function CategoryTabs({
  categories,
  activeId,
  onSelect,
  showPopular = false,
  onSearch,
  restaurantName,
}: Props) {
  const { t, direction } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [searchQuery, setSearchQuery] = useState("");

  // Auto-scroll the active category button into view
  useEffect(() => {
    if (!activeId) return;
    
    const button = buttonRefs.current.get(activeId);
    const container = scrollRef.current;
    
    if (button && container) {
      const containerRect = container.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      
      // Check if button is outside visible area
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

  // Category icons/emojis mapping (can be extended)
  const categoryEmojis: Record<string, string> = {
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

  const getCategoryEmoji = (name: string) => {
    const lowercaseName = name.toLowerCase();
    for (const [key, emoji] of Object.entries(categoryEmojis)) {
      if (lowercaseName.includes(key)) {
        return emoji;
      }
    }
    return null;
  };

  return (
    <div className="sticky top-14 z-40 bg-[var(--surface)] border-b border-[var(--divider)]">
      <div className="flex items-center gap-4 px-4 sm:px-6 py-3">
        {/* Scrollable category tabs */}
        <div
          ref={scrollRef}
          className="flex-1 flex gap-2 overflow-x-auto scrollbar-hide"
          dir={direction}
        >
          {showPopular && (
            <button
              ref={(el) => { if (el) buttonRefs.current.set(POPULAR_CATEGORY_ID, el); }}
              onClick={() => onSelect(POPULAR_CATEGORY_ID)}
              className={clsx(
                "category-pill flex items-center gap-1.5",
                activeId === POPULAR_CATEGORY_ID && "active"
              )}
            >
              <span>⭐</span>
              <span>{t("popular") || "Most ordered"}</span>
            </button>
          )}
          
          {categories.map((cat) => {
            const emoji = getCategoryEmoji(cat.name);
            return (
              <button
                key={cat.id}
                ref={(el) => { if (el) buttonRefs.current.set(cat.id, el); }}
                onClick={() => onSelect(cat.id)}
                className={clsx(
                  "category-pill flex items-center gap-1.5",
                  activeId === cat.id && "active"
                )}
              >
                {emoji && <span>{emoji}</span>}
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>

        {/* Search input - Wolt style */}
        {onSearch && (
          <div className="hidden sm:flex search-input flex-shrink-0 w-64">
            <svg
              className="w-4 h-4 text-[var(--text-soft)]"
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
              className="bg-transparent outline-none flex-1 text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearch("")}
                className="text-[var(--text-soft)] hover:text-[var(--text)]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
