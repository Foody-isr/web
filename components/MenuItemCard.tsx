import { MenuItem } from "@/lib/types";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";

type Props = {
  item: MenuItem;
  onSelect: (item: MenuItem) => void;
  isPopular?: boolean;
  isNew?: boolean;
  /** Menu display layout: list (horizontal), grid (vertical cards), compact (no images) */
  layout?: "list" | "grid" | "compact";
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

  const comboBadge = isPicked && (
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
  );

  /** Animated add/check button used in list and grid image overlays */
  const animatedAddButton = (position: "corner" | "round") => {
    if (!isAvailable || comboInactive || (isComboOnly && !comboEligible)) return null;
    const isCorner = position === "corner";
    return (
      <div className={clsx(
        isCorner
          ? "absolute -top-[1px] -right-[1px] rtl:-right-[1px] rtl:-left-[1px] rtl:right-auto w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center rounded-tr-xl rounded-bl-2xl rtl:rounded-tr-none rtl:rounded-tl-xl rtl:rounded-bl-none rtl:rounded-br-2xl transition-colors"
          : "absolute top-2 right-2 rtl:right-auto rtl:left-2 w-8 h-8 flex items-center justify-center rounded-full transition-colors shadow-md",
        isPicked || justAdded ? "bg-brand" : "bg-[var(--surface-subtle)]"
      )}>
        <AnimatePresence mode="wait">
          {isPicked || justAdded ? (
            <motion.svg
              key="check"
              className={clsx(isCorner ? "w-3.5 h-3.5 sm:w-4 sm:h-4" : "w-3.5 h-3.5", "text-white")}
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
              className={clsx(isCorner ? "w-4 h-4 sm:w-5 sm:h-5" : "w-4 h-4", "text-brand")}
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
    );
  };

  const badges = (
    <div className="flex items-center gap-1.5 flex-wrap">
      {isComboOnly ? (
        <span className="whitespace-nowrap text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand/10 text-brand uppercase tracking-wide">
          Combo
        </span>
      ) : (
        <span className="price text-base">
          ₪{item.price.toFixed(2)}
        </span>
      )}
      {isPopular && (
        <span className="badge badge-popular text-[10px] py-0.5 whitespace-nowrap">Popular</span>
      )}
      {!isAvailable && (
        <span className="badge bg-[var(--surface-elevated)] text-[var(--text-muted)] text-[10px] py-0.5 whitespace-nowrap">Sold out</span>
      )}
      {comboEligible && !isPicked && (
        <span className="whitespace-nowrap text-[10px] font-semibold text-brand animate-pulse">Tap to add</span>
      )}
    </div>
  );

  const cardClasses = clsx(
    "text-left w-full group relative",
    !isAvailable && "opacity-50 cursor-not-allowed hover:scale-100",
    comboInactive && "opacity-40 pointer-events-none",
    comboEligible && "ring-2 ring-brand/50 shadow-brand/10",
    isPicked && "ring-2 ring-brand bg-brand/5",
    isComboOnly && !comboEligible && "opacity-60"
  );

  const handleClick = () => {
    if (!isAvailable) return;
    if (isComboOnly && !comboEligible) return;
    if (comboInactive) return;
    onSelect(item);
  };

  // ── Compact layout: no image, dense row ──
  if (layout === "compact") {
    return (
      <motion.button
        layout
        whileHover={isAvailable && !comboInactive ? { scale: 1.01 } : undefined}
        whileTap={isAvailable && !comboInactive ? { scale: 0.99 } : undefined}
        onClick={handleClick}
        disabled={!isAvailable || (isComboOnly && !comboEligible)}
        className={clsx(cardClasses, "menu-card flex items-center gap-3 !p-3")}
      >
        {comboBadge}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-[var(--text)] truncate leading-tight text-sm">{item.name}</h3>
            {isNew && <span className="badge badge-new text-[10px] py-0.5">New</span>}
          </div>
          {item.description && (
            <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">{item.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {badges}
          {isAvailable && !comboInactive && !(isComboOnly && !comboEligible) && (
            <div className={clsx(
              "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
              isPicked || justAdded ? "bg-brand" : "bg-[var(--surface-subtle)]"
            )}>
              {isPicked || justAdded ? (
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
              )}
            </div>
          )}
        </div>
      </motion.button>
    );
  }

  // ── Grid layout: vertical card with image on top ──
  if (layout === "grid") {
    return (
      <motion.button
        layout
        whileHover={isAvailable && !comboInactive ? { scale: 1.02 } : undefined}
        whileTap={isAvailable && !comboInactive ? { scale: 0.98 } : undefined}
        onClick={handleClick}
        disabled={!isAvailable || (isComboOnly && !comboEligible)}
        className={clsx(cardClasses, "menu-card !flex-col !items-stretch !p-0 overflow-hidden")}
      >
        {comboBadge}
        {/* Image */}
        <div className="relative w-full aspect-[4/3] bg-[var(--surface-elevated)]">
          <Image
            src={item.imageUrl || "/assets/placeholder-item.svg"}
            alt={item.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, 33vw"
          />
          {animatedAddButton("round")}
          {hasModifiers && isAvailable && !comboEligible && (
            <div className="absolute bottom-2 left-2 rtl:left-auto rtl:right-2">
              <div className="w-5 h-5 rounded-full bg-brand/90 flex items-center justify-center text-white text-xs">✨</div>
            </div>
          )}
        </div>
        {/* Content */}
        <div className="p-3 flex flex-col gap-1.5">
          <div className="flex items-start gap-2">
            <h3 className="font-bold text-[var(--text)] line-clamp-2 leading-tight text-sm">{item.name}</h3>
            {isNew && <span className="badge badge-new text-[10px] py-0.5">New</span>}
          </div>
          {item.description && (
            <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed">{item.description}</p>
          )}
          <div className="mt-auto pt-1">{badges}</div>
        </div>
      </motion.button>
    );
  }

  // ── List layout (default): horizontal card with image on right ──
  return (
    <motion.button
      layout
      whileHover={isAvailable && !comboInactive ? { scale: 1.01 } : undefined}
      whileTap={isAvailable && !comboInactive ? { scale: 0.99 } : undefined}
      onClick={handleClick}
      disabled={!isAvailable || (isComboOnly && !comboEligible)}
      className={clsx(cardClasses, "menu-card")}
    >
      {comboBadge}

      {/* Content Section */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          <div className="flex items-start gap-2 flex-wrap">
            <h3 className="font-bold text-[var(--text)] line-clamp-2 leading-tight">{item.name}</h3>
            {isNew && <span className="badge badge-new text-[10px] py-0.5">New</span>}
          </div>
          {item.description && (
            <p className="text-sm text-[var(--text-muted)] line-clamp-2 mt-1.5 leading-relaxed">{item.description}</p>
          )}
        </div>
        <div className="mt-3">{badges}</div>
      </div>

      {/* Image Section */}
      <div className={clsx(
        "relative flex-shrink-0",
        "w-24 h-24 sm:w-28 sm:h-28"
      )}>
        <div className="absolute inset-0 rounded-xl overflow-hidden bg-[var(--surface-elevated)]">
          <Image
            src={item.imageUrl || "/assets/placeholder-item.svg"}
            alt={item.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 96px, 112px"
          />
        </div>
        {/* Add button overlay */}
        {animatedAddButton("corner")}
        {/* Customizable indicator */}
        {hasModifiers && isAvailable && !comboEligible && (
          <div className="absolute bottom-2 left-2 rtl:left-auto rtl:right-2">
            <div className="w-5 h-5 rounded-full bg-brand/90 flex items-center justify-center text-white text-xs">✨</div>
          </div>
        )}
      </div>
    </motion.button>
  );
}
