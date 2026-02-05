import { MenuCategory } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import clsx from "clsx";

export const ALL_CATEGORY_ID = "__all__";

type Props = {
  categories: MenuCategory[];
  activeId?: string;
  onSelect: (id: string) => void;
  showAll?: boolean;
};

export function CategoryTabs({ categories, activeId, onSelect, showAll = false }: Props) {
  const { t } = useI18n();

  return (
    <div className="sticky top-0 z-20 px-4 py-3 bg-[var(--bg-muted)]/90 backdrop-blur-md border-b border-light-divider">
      <div className="flex gap-2 overflow-x-auto scrollbar-thin">
        {showAll && (
          <button
            onClick={() => onSelect(ALL_CATEGORY_ID)}
            className={clsx(
              "px-4 py-2 rounded-chip text-sm font-semibold transition whitespace-nowrap",
              activeId === ALL_CATEGORY_ID
                ? "bg-brand text-white shadow-sm"
                : "bg-light-subtle border border-light-divider text-ink-muted hover:border-brand hover:text-ink"
            )}
          >
            {t("all")}
          </button>
        )}
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={clsx(
              "px-4 py-2 rounded-chip text-sm font-semibold transition whitespace-nowrap",
              activeId === cat.id
                ? "bg-brand text-white shadow-sm"
                : "bg-light-subtle border border-light-divider text-ink-muted hover:border-brand hover:text-ink"
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>
    </div>
  );
}
