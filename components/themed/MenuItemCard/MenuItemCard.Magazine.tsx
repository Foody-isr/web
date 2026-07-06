import { useI18n } from "@/lib/i18n";
import { useMenuLanguage } from "@/lib/menu-language";
import { tField } from "@/lib/translations";
import { roleTextStyle } from "@/lib/themes/typography";
import { isByWeight, itemDisplayPriceRange, weightEstimatePrice } from "@/lib/cart";
import type { MenuItemCardProps } from "./MenuItemCard";

export function Magazine({ item, currencySymbol, isMostPopular, onClick }: MenuItemCardProps) {
  const { t } = useI18n();
  const { menuLocale } = useMenuLanguage();
  const itemName = tField(item, "name", menuLocale);
  const itemDescription = tField(item, "description", menuLocale);
  const priceRange = itemDisplayPriceRange(item);
  // By-weight items show a display-only estimate (server stays authoritative).
  const byWeight = isByWeight(item);
  const displayPrice = byWeight ? weightEstimatePrice(item) : priceRange.min;
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
          <h3
            className="font-display text-ink font-semibold flex-1"
            style={roleTextStyle("itemName", "1.125rem", "display", 600, "none")}
          >
            {itemName}
          </h3>
          <span className="inline-flex items-baseline gap-1">
            {byWeight && (
              <span className="text-[10px] font-semibold text-ink-muted whitespace-nowrap">
                {t("byWeightTag")}
              </span>
            )}
            <span
              className="text-accent font-display font-bold tabular-nums"
              style={roleTextStyle("itemPrice", "1.125rem", "display", 700)}
            >
              {currencySymbol}
              {displayPrice.toFixed(2)}
            </span>
          </span>
        </div>
        {isMostPopular && (
          <span className="inline-flex items-center gap-1 text-[10px] text-accent uppercase tracking-wider font-semibold mt-1">
            ★ Most popular
          </span>
        )}
        {itemDescription && (
          <p
            className="text-ink-muted mt-2 line-clamp-3"
            style={roleTextStyle("itemDescription", "0.875rem", "body", 400, "none")}
          >
            {itemDescription}
          </p>
        )}
      </div>
    </button>
  );
}
