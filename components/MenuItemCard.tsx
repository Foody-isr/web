import { MenuItem } from "@/lib/types";
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
  /** Called when user taps the pick badge to remove one pick */
  onComboRemove?: (item: MenuItem) => void;
  /** Brief flash when item was added to cart without opening modal */
  justAdded?: boolean;
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
  onComboRemove,
  justAdded,
}: Props) {
  const isAvailable = item.available !== false;
  const hasModifiers = item.modifiers && item.modifiers.length > 0;
  const isComboOnly = item.comboOnly === true;
  const isPicked = comboPickCount > 0;

  return (
    <motion.button
      layout
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
              item.imageUrl ||
              "https://images.unsplash.com/photo-1604908177693-2ba522bd87c7?auto=format&fit=crop&w=400&q=80"
            }
            alt={item.name}
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
          className="absolute -top-2 -left-2 rtl:-left-auto rtl:-right-2 z-10 w-7 h-7 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center shadow-md cursor-pointer hover:bg-red-500 transition-colors group/badge"
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
            <h3 className={clsx(
              "font-bold text-[var(--text)] leading-tight",
              layout === "grid" ? "text-[13px] line-clamp-2" : "line-clamp-2"
            )}>
              {item.name}
            </h3>
            {isNew && (
              <span className="badge badge-new text-[10px] py-0.5">🆕 {item.tags?.includes("new") ? "חדש" : "New"}</span>
            )}
          </div>

          {item.description && (
            <p className={clsx(
              "text-[var(--text-muted)] leading-relaxed",
              layout === "grid" ? "text-xs mt-1 line-clamp-2" : "text-sm mt-1.5 line-clamp-2"
            )}>
              {item.description}
            </p>
          )}
        </div>

        {/* Bottom row: Price + badges */}
        <div className={clsx("flex items-center gap-1.5 flex-wrap", layout === "grid" ? "mt-2" : "mt-3")}>
          {isComboOnly ? (
            <span className="whitespace-nowrap text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand/10 text-brand uppercase tracking-wide">
              🍽️ Combo
            </span>
          ) : (
            <span className={clsx("price", layout === "grid" ? "text-sm" : "text-base")}>
              ₪{item.price.toFixed(2)}
            </span>
          )}

          {isPopular && (
            <span className="badge badge-popular text-[10px] py-0.5 whitespace-nowrap">
              Popular
            </span>
          )}

          {!isAvailable && (
            <span className="badge bg-[var(--surface-elevated)] text-[var(--text-muted)] text-[10px] py-0.5 whitespace-nowrap">
              Sold out
            </span>
          )}

          {comboEligible && !isPicked && (
            <span className="whitespace-nowrap text-[10px] font-semibold text-brand animate-pulse">
              Tap to add
            </span>
          )}
        </div>
      </div>

      {/* Image Section — hidden for grid (already on top) */}
      {layout !== "grid" && <div className={clsx(
        "relative flex-shrink-0",
        "w-24 h-24 sm:w-28 sm:h-28"
      )}>
        <div className="absolute inset-0 rounded-xl overflow-hidden bg-[var(--surface-elevated)]">
          <Image
            src={
              item.imageUrl ||
              "https://images.unsplash.com/photo-1604908177693-2ba522bd87c7?auto=format&fit=crop&w=400&q=80"
            }
            alt={item.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 96px, 112px"
          />
        </div>
        
        {/* Add button overlay */}
        {isAvailable && !comboInactive && !(isComboOnly && !comboEligible) && (
          <div className={clsx(
            "absolute -top-[1px] -right-[1px] rtl:-right-[1px] rtl:-left-[1px] rtl:right-auto w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center rounded-tr-xl rounded-bl-2xl rtl:rounded-tr-none rtl:rounded-tl-xl rtl:rounded-bl-none rtl:rounded-br-2xl transition-colors",
            isPicked || justAdded ? "bg-brand" : "bg-[var(--surface-subtle)]"
          )}>
            <AnimatePresence mode="wait">
              {isPicked || justAdded ? (
                <motion.svg
                  key="check"
                  className="w-4 h-4 text-white"
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
                  className="w-5 h-5 text-brand"
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

        {/* Customizable indicator */}
        {hasModifiers && isAvailable && !comboEligible && (
          <div className="absolute bottom-2 left-2 rtl:left-auto rtl:right-2">
            <div className="w-5 h-5 rounded-full bg-brand/90 flex items-center justify-center text-white text-xs">
              ✨
            </div>
          </div>
        )}
      </div>}
    </motion.button>
  );
}
