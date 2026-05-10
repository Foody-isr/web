import { useI18n } from "@/lib/i18n";
import { tField } from "@/lib/translations";
import type { MenuItemCardProps } from "./MenuItemCard";

export function Compact({ item, currencySymbol, isMostPopular, onClick }: MenuItemCardProps) {
  const { locale } = useI18n();
  const itemName = tField(item, "name", locale);
  const itemDescription = tField(item, "description", locale);
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-start flex items-start gap-3 p-3 rounded-lg hover:bg-surface-muted transition"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <h3 className="font-display text-ink text-[15px] font-semibold truncate">{itemName}</h3>
          <span className="ms-auto text-accent font-display font-bold tabular-nums">
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
          <p className="text-ink-muted text-sm mt-1 line-clamp-2">{itemDescription}</p>
        )}
      </div>
      {item.imageUrl && (
        <div className="shrink-0 w-20 h-20 rounded-md overflow-hidden bg-surface-muted">
          <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )}
    </button>
  );
}
