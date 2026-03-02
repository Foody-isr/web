import { MenuItem } from "@/lib/types";
import clsx from "clsx";
import { motion } from "framer-motion";
import Image from "next/image";

type Props = {
  item: MenuItem;
  onSelect: (item: MenuItem) => void;
  isPopular?: boolean;
  isNew?: boolean;
  /** When set, the user is building a combo — this item is eligible for the current step */
  comboEligible?: boolean;
  /** Number of times this item is already picked for the current combo step */
  comboPickCount?: number;
  /** True when a combo is active but this item is NOT eligible for the current step */
  comboInactive?: boolean;
};

export function MenuItemCard({
  item,
  onSelect,
  isPopular,
  isNew,
  comboEligible,
  comboPickCount = 0,
  comboInactive,
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
        "menu-card text-left w-full group relative",
        !isAvailable && "opacity-50 cursor-not-allowed hover:scale-100",
        comboInactive && "opacity-40 pointer-events-none",
        comboEligible && "ring-2 ring-brand/50 shadow-brand/10",
        isPicked && "ring-2 ring-brand bg-brand/5",
        isComboOnly && !comboEligible && "opacity-60"
      )}
    >
      {/* Combo pick badge (overlay) */}
      {isPicked && (
        <div className="absolute -top-2 -left-2 rtl:-left-auto rtl:-right-2 z-10 w-6 h-6 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center shadow-md">
          {comboPickCount}
        </div>
      )}

      {/* Content Section */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        {/* Title row with badges */}
        <div>
          <div className="flex items-start gap-2 flex-wrap">
            <h3 className="font-bold text-[var(--text)] line-clamp-2 leading-tight">
              {item.name}
            </h3>
            {isNew && (
              <span className="badge badge-new text-[10px] py-0.5">🆕 {item.tags?.includes("new") ? "חדש" : "New"}</span>
            )}
          </div>
          
          {/* Description */}
          {item.description && (
            <p className="text-sm text-[var(--text-muted)] line-clamp-2 mt-1.5 leading-relaxed">
              {item.description}
            </p>
          )}
        </div>

        {/* Bottom row: Price + badges */}
        <div className="flex items-center gap-2 mt-3">
          {isComboOnly ? (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-brand/10 text-brand uppercase tracking-wide">
              🍽️ Combo only
            </span>
          ) : (
            <span className="price text-base">
              ₪{item.price.toFixed(2)}
            </span>
          )}
          
          {isPopular && (
            <span className="badge badge-popular text-[10px] py-0.5">
              Popular
            </span>
          )}
          
          {!isAvailable && (
            <span className="badge bg-[var(--surface-elevated)] text-[var(--text-muted)] text-[10px] py-0.5">
              Sold out
            </span>
          )}

          {comboEligible && !isPicked && (
            <span className="text-xs font-semibold text-brand animate-pulse">
              Tap to add
            </span>
          )}
        </div>
      </div>

      {/* Image Section */}
      <div className="relative flex-shrink-0 w-24 h-24 sm:w-28 sm:h-28">
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
            "absolute -top-[1px] -right-[1px] rtl:-right-[1px] rtl:-left-[1px] rtl:right-auto w-11 h-11 flex items-center justify-center rounded-tr-xl rounded-bl-2xl rtl:rounded-tr-none rtl:rounded-tl-xl rtl:rounded-bl-none rtl:rounded-br-2xl transition-colors",
            isPicked ? "bg-brand" : "bg-[#2C2D33]"
          )}>
            {isPicked ? (
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            )}
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
      </div>
    </motion.button>
  );
}
