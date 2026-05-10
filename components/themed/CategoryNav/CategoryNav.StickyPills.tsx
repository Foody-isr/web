import type { CategoryNavProps } from "./CategoryNav";

export function StickyPills({
  groups,
  activeGroupId,
  onSelect,
  position,
}: CategoryNavProps & { position: "top" | "bottom" }) {
  const isBottom = position === "bottom";
  const positionClasses = isBottom
    ? "fixed bottom-0 inset-x-0 border-t py-3"
    : "sticky border-b py-2";
  const stickyTop = !isBottom ? { top: "var(--nav-offset-top, 0)" } : undefined;

  return (
    <nav
      className={`z-20 backdrop-blur-md border-divider ${positionClasses}`}
      style={{
        backgroundColor: "color-mix(in srgb, var(--bg) 85%, transparent)",
        ...stickyTop,
      }}
    >
      <div className="flex gap-2 overflow-x-auto px-4 no-scrollbar">
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => onSelect(g.id)}
            className={`shrink-0 px-4 py-2 rounded-pill text-sm font-medium transition ${
              g.id === activeGroupId
                ? "bg-accent text-accent-ink"
                : "bg-surface-muted text-ink-muted hover:text-ink"
            }`}
          >
            {g.name}
          </button>
        ))}
      </div>
    </nav>
  );
}
