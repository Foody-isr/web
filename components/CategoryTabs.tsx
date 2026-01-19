import { MenuCategory } from "@/lib/types";
import clsx from "clsx";

type Props = {
  categories: MenuCategory[];
  activeId?: string;
  onSelect: (id: string) => void;
};

export function CategoryTabs({ categories, activeId, onSelect }: Props) {
  return (
    <div className="sticky top-0 z-20 -mx-4 px-4 py-3 bg-[var(--bg-muted)]/80 backdrop-blur-md border-b border-black/5">
      <div className="flex gap-2 overflow-x-auto scrollbar-thin">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={clsx(
              "px-4 py-2 rounded-full border text-sm font-medium transition whitespace-nowrap",
              activeId === cat.id
                ? "bg-brand text-white border-brand shadow-sm"
                : "border-black/10 text-ink/70 hover:border-brand"
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>
    </div>
  );
}
