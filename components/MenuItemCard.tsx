import { MenuItem } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { useMenuLanguage } from "@/lib/menu-language";
import { tField } from "@/lib/translations";
import { deriveItemPortion } from "@/lib/portion";
import { formatEstimatedWeight, isByWeight, itemDisplayPriceRange, weightEstimatePrice } from "@/lib/cart";
import { roleTextStyle } from "@/lib/themes/typography";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";

type Props = {
  item: MenuItem;
  onSelect: (item: MenuItem) => void;
  layout?: "list" | "grid";
  isPopular?: boolean;
  isNew?: boolean;
  /** When set, the user is building a combo — this item is eligible for the current step */
  comboEligible?: boolean;
  /** Number of times this item is already picked for the current combo step */
  comboPickCount?: number;
  /** True when a combo is active but this item is NOT eligible for the current step */
  comboInactive?: boolean;
  /** True when the current combo step offers this item but every entry it offers
   *  is out of stock. Distinct from the item's own state: the step may pin a size
   *  (e.g. 250g) that ran out while the item still sells in another size. */
  comboSoldOut?: boolean;
  /** Called when user taps the pick badge to remove one pick */
  onComboRemove?: (item: MenuItem) => void;
  /** Brief flash when item was added to cart without opening modal */
  justAdded?: boolean;
  /** Preparation notice, pre-formatted (e.g. "48 h ahead"), shown as a badge.
   *  Only set for items that cost MORE than the restaurant's baseline: badging
   *  the baseline would mark every card and single out nothing. The caller owns
   *  that rule (see lib/fulfillment.isSlowerThanDefault) so this stays a dumb
   *  presentational component. */
  leadBadge?: string;
};

export function MenuItemCard({
  item,
  onSelect,
  layout = "list",
  isPopular,
  isNew,
  comboEligible,
  comboPickCount = 0,
  comboInactive,
  comboSoldOut,
  onComboRemove,
  justAdded,
  leadBadge,
}: Props) {
  const { t, locale } = useI18n();
  const { menuLocale } = useMenuLanguage();
  const itemName = tField(item, "name", menuLocale);
  const itemDescription = tField(item, "description", menuLocale);
  // Serving-size line under the title. Unlike the modal, the card shows it for
  // sized items too (the derived range, e.g. "250g - 500g") since there are no
  // size rows here to carry the per-option portions.
  const itemPortion = deriveItemPortion(item, menuLocale).label;
  const isSoldOut = item.availabilityState === "sold_out" || comboSoldOut === true;
  const isLowStock = item.availabilityState === "low";
  const isAvailable = item.available !== false && !isSoldOut;
  const hasModifiers = item.modifiers && item.modifiers.length > 0;
  const isComboOnly = item.comboOnly === true;
  const isPicked = comboPickCount > 0;
  // Items priced via size/variant options keep a 0 base price; derive the
  // starting price from those options so the card shows ₪35 (not a misleading
  // ₪0.00, and not the full range — just the entry price).
  const priceRange = itemDisplayPriceRange(item);
  // By-weight items show a display-only estimate (server stays authoritative).
  const byWeight = isByWeight(item);
  const weightEstimate = byWeight ? weightEstimatePrice(item) : 0;
  const weightParts = byWeight ? formatEstimatedWeight(item.estimatedWeightGrams ?? 0, locale) : null;

  return (
    <motion.button
      layout
      data-combo-item-id={item.id}
      whileHover={isAvailable && !comboInactive ? { scale: 1.01 } : undefined}
      whileTap={isAvailable && !comboInactive ? { scale: 0.99 } : undefined}
      onClick={() => {
        if (!isAvailable) return;
        // combo_only items are NOT selectable outside combo mode
        if (isComboOnly && !comboEligible) return;
        // Non-eligible items during combo mode do nothing
        if (comboInactive) return;
        onSelect(item);
      }}
      disabled={!isAvailable || (isComboOnly && !comboEligible)}
      className={clsx(
        "text-left w-full group relative",
        layout === "grid" ? "menu-card-grid flex flex-col rounded-2xl bg-[var(--surface)] overflow-hidden shadow-sm border border-[var(--divider)]" : "menu-card",
        !isAvailable && "opacity-50 cursor-not-allowed hover:scale-100",
        comboInactive && "opacity-40 pointer-events-none",
        comboEligible && "ring-2 ring-brand/50 shadow-brand/10",
        isPicked && "ring-2 ring-brand bg-brand/5",
        isComboOnly && !comboEligible && "opacity-60"
      )}
    >
      {/* Grid layout: image on top */}
      {layout === "grid" && (
        <div className="relative w-full aspect-[3/2] bg-[var(--surface-elevated)]">
          <Image
            src={
              item.imageUrl || "/assets/placeholder-item.svg"
            }
            alt={itemName}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, 33vw"
          />
          {/* Add button overlay for grid */}
          {isAvailable && !comboInactive && !(isComboOnly && !comboEligible) && (
            <div className={clsx(
              "absolute top-2 right-2 rtl:right-auto rtl:left-2 w-8 h-8 flex items-center justify-center rounded-full transition-colors shadow-md",
              isPicked || justAdded ? "bg-brand" : "bg-[var(--surface-subtle)]"
            )}>
              <AnimatePresence mode="wait">
                {isPicked || justAdded ? (
                  <motion.svg
                    key="check"
                    className="w-3.5 h-3.5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: [0, 1.3, 1], opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </motion.svg>
                ) : (
                  <motion.svg
                    key="plus"
                    className="w-4 h-4 text-brand"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </motion.svg>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {/* Combo pick badge — tap to remove one */}
      {isPicked && (
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onComboRemove?.(item);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              onComboRemove?.(item);
            }
          }}
          className={clsx(
            "absolute z-10 rounded-full bg-brand text-white font-bold flex items-center justify-center shadow-md cursor-pointer hover:bg-red-500 transition-colors group/badge",
            // Grid cards have overflow-hidden, so the badge must sit INSIDE the
            // corner (mirroring the top-right add button) or it gets clipped into
            // a square wedge. List cards have no clipping, so it can float outside.
            layout === "grid"
              ? "top-2 left-2 rtl:left-auto rtl:right-2 w-8 h-8 text-sm"
              : "-top-2 -left-2 rtl:-left-auto rtl:-right-2 w-7 h-7 text-xs"
          )}
          title="Remove one"
        >
          <span className="group-hover/badge:hidden">{comboPickCount}</span>
          <svg className="w-3.5 h-3.5 hidden group-hover/badge:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
          </svg>
        </div>
      )}

      {/* Content Section */}
      <div className={clsx(
        "flex-1 min-w-0 flex flex-col justify-between",
        layout === "grid" ? "p-2.5" : "py-0.5"
      )}>
        {/* Title row with badges */}
        <div>
          <div className="flex items-start gap-2 flex-wrap">
            <h3
              className={clsx(
                "font-bold text-[var(--text)] leading-tight",
                "line-clamp-2"
              )}
              style={roleTextStyle("itemName", "1em", "inherit", 700, "none", "var(--text)")}
            >
              {itemName}
            </h3>
            {isNew && (
              <span className="badge badge-new text-[10px] py-0.5">🆕 {item.tags?.includes("new") ? "חדש" : "New"}</span>
            )}
          </div>

          {itemPortion && (
            <p className="text-xs font-semibold text-brand mt-0.5 tabular-nums">
              {itemPortion}
            </p>
          )}

          {itemDescription && (
            <p
              className={clsx(
                "text-[var(--text-muted)] leading-relaxed",
                "mt-1.5 line-clamp-2"
              )}
              style={roleTextStyle("itemDescription", "0.875rem", "inherit", 400, "none", "var(--text-muted)")}
            >
              {itemDescription}
            </p>
          )}
        </div>

        {/* Bottom row: Price + badges */}
        <div className={clsx("flex items-center gap-1.5 flex-wrap", "mt-3")}>
          {isComboOnly ? (
            <span className="whitespace-nowrap text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand/10 text-brand uppercase tracking-wide">
              🍽️ Combo
            </span>
          ) : byWeight ? (
            <span className="inline-flex items-baseline gap-x-1.5 gap-y-0.5 flex-wrap">
              <span className="price whitespace-nowrap" style={roleTextStyle("itemPrice", "1rem", "inherit", 700, undefined, "var(--price)")}>
                {`₪${(item.pricePerKg ?? 0).toLocaleString(locale)}`}
                <span className="text-[11px] font-semibold text-[var(--text-muted)] ms-0.5">
                  {t("perKgUnit")}
                </span>
              </span>
              {weightParts && (
                <span className="text-[11px] text-[var(--text-muted)] whitespace-nowrap">
                  {`≈ ₪${Math.round(weightEstimate).toLocaleString(locale)} · ~${weightParts.value} ${t(weightParts.isKg ? "unitKg" : "unitG")}`}
                </span>
              )}
            </span>
          ) : (
            <span className="price" style={roleTextStyle("itemPrice", "1rem", "inherit", 700, undefined, "var(--price)")}>
              {`₪${priceRange.min.toFixed(2)}`}
            </span>
          )}

          {isPopular && (
            <span className="badge badge-popular text-[10px] py-0.5 whitespace-nowrap">
              Popular
            </span>
          )}

          {isAvailable && isLowStock && (
            <span className="badge bg-amber-500/15 text-amber-500 text-[10px] py-0.5 whitespace-nowrap">
              {item.buildableCount != null ? `${item.buildableCount} ${t("left")}` : t("lowStock")}
            </span>
          )}

          {/* Amber like low stock rather than brand-tinted: this is a heads-up
              the customer has to act on, and amber keeps its contrast whatever
              palette the restaurant picked (the grid here is pink on pink). */}
          {isAvailable && leadBadge && (
            <span className="badge bg-amber-500/15 text-amber-500 text-[10px] py-0.5 whitespace-nowrap">
              ⏱ {leadBadge}
            </span>
          )}

          {!isAvailable && (
            <span className="badge bg-[var(--surface-elevated)] text-[var(--text-muted)] text-[10px] py-0.5 whitespace-nowrap">
              {t("soldOut")}
            </span>
          )}

          {comboEligible && !isPicked && (
            <span className="whitespace-nowrap text-[10px] font-semibold text-brand animate-pulse">
              Tap to add
            </span>
          )}
        </div>
      </div>

      {/* Image Section (list layout) — design handoff "bite-mark" pattern:
          the image has a circular cutout in the top-right corner, and the
          + button sits IN that cutout with the card's background color so
          it visually punches through the photo. */}
      {layout !== "grid" && (
        <div className="relative flex-shrink-0 w-[108px] h-[108px] sm:w-28 sm:h-28">
          {/* Image with radial-gradient bite-mark mask in the top-right */}
          <div
            className="absolute inset-0 rounded-2xl bg-[var(--surface-elevated)]"
            style={{
              // 22px radius cutout, anchored at the top-right corner.
              // In RTL the cutout flips to the top-left.
              WebkitMaskImage:
                "radial-gradient(circle 22px at calc(100% - 0px) 0%, transparent 22px, black 23px)",
              maskImage:
                "radial-gradient(circle 22px at calc(100% - 0px) 0%, transparent 22px, black 23px)",
            }}
          >
            <Image
              src={item.imageUrl || "/assets/placeholder-item.svg"}
              alt={itemName}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105 rounded-2xl"
              sizes="(max-width: 640px) 108px, 112px"
            />
          </div>

          {/* Add button — true circle, sits in the bite-mark cutout.
              Background matches the card surface (var(--surface)) so it reads
              as a "carved" hole through the photo into the card behind it. */}
          {isAvailable && !comboInactive && !(isComboOnly && !comboEligible) && (
            <div
              className={clsx(
                "absolute -top-1.5 -end-1.5 w-[38px] h-[38px] rounded-full flex items-center justify-center transition-colors",
                isPicked || justAdded
                  ? "bg-brand"
                  : "bg-[var(--surface)]",
              )}
            >
              <AnimatePresence mode="wait">
                {isPicked || justAdded ? (
                  <motion.svg
                    key="check"
                    className="w-[18px] h-[18px] text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: [0, 1.3, 1], opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </motion.svg>
                ) : (
                  <motion.svg
                    key="plus"
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <path
                      d="M12 5v14M5 12h14"
                      stroke="var(--brand-dark, var(--brand))"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                    />
                  </motion.svg>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Customizable indicator */}
          {hasModifiers && isAvailable && !comboEligible && (
            <div className="absolute bottom-2 start-2">
              <div className="w-5 h-5 rounded-full bg-brand/90 flex items-center justify-center text-white text-xs">
                ✨
              </div>
            </div>
          )}
        </div>
      )}
    </motion.button>
  );
}
