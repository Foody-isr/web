"use client";

import { GuestAccountMenu } from "@/components/GuestAccountMenu";
import type { GuestOrder } from "@/services/api";

/**
 * Order-page-specific controls that live in the unified SiteNavbar's right
 * cluster (passed via its `rightSlot`): the list/magazine density toggle and the
 * guest account menu. These used to live in the legacy Wolt-style TopBar, which
 * the order page has now retired in favor of the one config-driven SiteNavbar.
 * The density toggle is desktop/tablet only (mobile uses the bottom bar's Compte
 * tab for account and doesn't offer the density switch).
 */
export function OrderToolbar({
  viewMode,
  onToggleViewMode,
  showViewToggle,
  restaurantId,
  currency,
  onReorder,
  textColor,
}: {
  viewMode?: "compact" | "magazine";
  onToggleViewMode?: () => void;
  showViewToggle?: boolean;
  restaurantId?: string;
  currency?: string;
  onReorder?: (order: GuestOrder) => void;
  textColor: string;
}) {
  return (
    <div className="flex items-center gap-2" style={{ color: textColor }}>
      {showViewToggle && viewMode && onToggleViewMode ? (
        <div className="hidden sm:flex items-center rounded-full p-0.5 bg-black/[0.06]">
          <button
            type="button"
            aria-label="Compact list view"
            aria-pressed={viewMode === "compact"}
            onClick={() => viewMode !== "compact" && onToggleViewMode()}
            className={`p-1.5 rounded-full transition ${viewMode === "compact" ? "bg-white text-[var(--text-primary)] shadow-sm" : "opacity-70 hover:opacity-100"}`}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 3h10M2 7h10M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Magazine view"
            aria-pressed={viewMode === "magazine"}
            onClick={() => viewMode !== "magazine" && onToggleViewMode()}
            className={`p-1.5 rounded-full transition ${viewMode === "magazine" ? "bg-white text-[var(--text-primary)] shadow-sm" : "opacity-70 hover:opacity-100"}`}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="2" y="2" width="10" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ) : null}

      {restaurantId && onReorder ? (
        <GuestAccountMenu
          restaurantId={restaurantId}
          currency={currency || "ILS"}
          onReorder={onReorder}
          buttonClassName="w-9 h-9 flex items-center justify-center rounded-full transition hover:bg-black/[0.06]"
        />
      ) : null}
    </div>
  );
}
