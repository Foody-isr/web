"use client";

import { useResolvedTheme } from "@/lib/themes/useResolvedTheme";

type Props = {
  restaurantName: string;
  logoUrl?: string;
  cartCount: number;
  viewMode: "compact" | "magazine";
  onToggleViewMode: () => void;
  onOpenSearch: () => void;
  onOpenFilter: () => void;
  onOpenCart: () => void;
  onToggleLanguage: () => void;
  hideName?: boolean;
};

export function TopBar({
  restaurantName, logoUrl, cartCount, hideName,
  viewMode, onToggleViewMode,
  onOpenSearch, onOpenFilter, onOpenCart, onToggleLanguage,
}: Props) {
  const { resolved } = useResolvedTheme();
  const showToggle = resolved?.layout.itemDensityToggle ?? false;

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 backdrop-blur-md border-b border-divider"
      style={{ backgroundColor: "color-mix(in srgb, var(--bg) 80%, transparent)" }}
    >
      {logoUrl && <img src={logoUrl} alt="" className="h-8 w-8 rounded-md object-cover" />}
      {!hideName && <span className="text-ink font-display text-base truncate">{restaurantName}</span>}

      <div className="ms-auto flex items-center gap-1">
        {showToggle && (
          <div className="flex items-center rounded-pill bg-surface-muted p-0.5">
            <button
              type="button" aria-label="Compact list"
              onClick={() => viewMode !== "compact" && onToggleViewMode()}
              className={`p-1.5 rounded-pill transition ${viewMode === "compact" ? "bg-accent text-accent-ink" : "text-ink-muted"}`}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3h10M2 7h10M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
            <button
              type="button" aria-label="Magazine"
              onClick={() => viewMode !== "magazine" && onToggleViewMode()}
              className={`p-1.5 rounded-pill transition ${viewMode === "magazine" ? "bg-accent text-accent-ink" : "text-ink-muted"}`}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="2" width="10" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
          </div>
        )}

        <button type="button" aria-label="Language" onClick={onToggleLanguage}
          className="p-2 rounded-pill text-ink-muted hover:text-ink hover:bg-surface-muted">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h6M5 2v2M3 4c0 3 2 5 5 6M9 6c-1 1-2 2-4 3M9 12l1.5-3.5L12 12M10 11h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <button type="button" aria-label="Search" onClick={onOpenSearch}
          className="p-2 rounded-pill text-ink-muted hover:text-ink hover:bg-surface-muted">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"/><path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
        <button type="button" aria-label="Filter" onClick={onOpenFilter}
          className="p-2 rounded-pill text-ink-muted hover:text-ink hover:bg-surface-muted">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
        <button type="button" aria-label="Cart" onClick={onOpenCart}
          className="relative p-2 rounded-pill text-ink-muted hover:text-ink hover:bg-surface-muted">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 3h2l1.5 8.5a1 1 0 0 0 1 .8h6.5M5.5 6h8L12 10H6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {cartCount > 0 && (
            <span className="absolute -top-0.5 -end-0.5 min-w-4 h-4 px-1 rounded-pill bg-accent text-accent-ink text-[10px] font-semibold flex items-center justify-center">
              {cartCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
