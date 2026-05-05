import { useI18n } from "@/lib/i18n";
import { tField } from "@/lib/translations";
import type { MenuItemCardProps } from "./MenuItemCard";

export function Magazine({ item, currencySymbol, isMostPopular, onClick }: MenuItemCardProps) {
  const { locale } = useI18n();
  const itemName = tField(item, "name", locale);
  const itemDescription = tField(item, "description", locale);
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full text-start rounded-lg overflow-hidden bg-surface hover:bg-surface-muted transition shadow-sm"
    >
      {item.imageUrl && (
        <div className="w-full bg-surface-muted" style={{ aspectRatio: "var(--card-image-ratio, 4 / 3)" }}>
          <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-baseline gap-2">
          <h3 className="font-display text-ink text-lg font-semibold flex-1">{itemName}</h3>
          <span className="text-accent font-display font-bold tabular-nums text-lg">
            {currencySymbol}
            {item.price.toFixed(2)}
          </span>
        </div>
        {isMostPopular && (
          <span className="inline-flex items-center gap-1 text-[10px] text-accent uppercase tracking-wider font-semibold mt-1">
            ★ Most popular
          </span>
        )}
        {itemDescription && (
          <p className="text-ink-muted text-sm mt-2 line-clamp-3">{itemDescription}</p>
        )}
      </div>
    </button>
  );
}
