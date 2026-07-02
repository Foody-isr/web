import { useMenuLanguage } from "@/lib/menu-language";
import { tField } from "@/lib/translations";
import { roleTextStyle } from "@/lib/themes/typography";
import { itemDisplayPriceRange } from "@/lib/cart";
import type { MenuItemCardProps } from "./MenuItemCard";

export function Compact({ item, currencySymbol, isMostPopular, onClick }: MenuItemCardProps) {
  const { menuLocale } = useMenuLanguage();
  const itemName = tField(item, "name", menuLocale);
  const itemDescription = tField(item, "description", menuLocale);
  const priceRange = itemDisplayPriceRange(item);
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-start flex items-start gap-3 p-3 rounded-lg hover:bg-surface-muted transition"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <h3
            className="font-display text-ink font-semibold truncate"
            style={roleTextStyle("itemName", "15px", "display", 600, "none")}
          >
            {itemName}
          </h3>
          <span
            className="ms-auto text-accent font-display font-bold tabular-nums"
            style={roleTextStyle("itemPrice", "1em", "display", 700)}
          >
            {currencySymbol}
            {priceRange.min.toFixed(2)}
          </span>
        </div>
        {isMostPopular && (
          <span className="inline-flex items-center gap-1 text-[10px] text-accent uppercase tracking-wider font-semibold mt-1">
            ★ Most popular
          </span>
        )}
        {itemDescription && (
          <p
            className="text-ink-muted mt-1 line-clamp-2"
            style={roleTextStyle("itemDescription", "0.875rem", "body", 400, "none")}
          >
            {itemDescription}
          </p>
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
