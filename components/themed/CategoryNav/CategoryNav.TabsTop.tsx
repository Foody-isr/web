import type { CategoryNavProps } from "./CategoryNav";

export function TabsTop({ groups, activeGroupId, onSelect }: CategoryNavProps) {
  return (
    <nav
      className="sticky z-20 backdrop-blur-md border-b border-divider"
      style={{
        backgroundColor: "color-mix(in srgb, var(--bg) 85%, transparent)",
        top: "var(--nav-offset-top, 0)",
      }}
    >
      <div className="flex gap-6 overflow-x-auto px-4 no-scrollbar">
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => onSelect(g.id)}
            className={`shrink-0 py-3 text-sm font-medium border-b-2 transition ${
              g.id === activeGroupId
                ? "border-accent text-ink"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {g.name}
          </button>
        ))}
      </div>
    </nav>
  );
}
