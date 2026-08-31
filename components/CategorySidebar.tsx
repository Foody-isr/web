"use client";

import { useI18n } from "@/lib/i18n";
import { useMenuLanguage } from "@/lib/menu-language";
import { tField } from "@/lib/translations";
import type { MenuCategory } from "@/lib/types";
import clsx from "clsx";
import { type CSSProperties, useEffect, useRef, useState } from "react";

type CategorySidebarStyle = CSSProperties & Record<`--${string}`, string>;

function categorySidebarStyle(): CategorySidebarStyle {
  const background = "var(--cat-bg, var(--surface))";
  const text = "var(--cat-text, var(--text))";
  return {
    backgroundColor: background,
    color: text,
    borderColor: "var(--cat-divider, var(--divider))",
    "--cat-current-text": text,
    "--cat-current-accent": "var(--cat-accent, var(--brand))",
    "--cat-current-active-bg": "var(--cat-active-bg, var(--brand))",
    "--cat-current-active-text": "var(--cat-active-text, white)",
  };
}

function categoryScrollBehavior(reducedMotion: boolean): ScrollBehavior {
  return reducedMotion ? "auto" : "smooth";
}

type NavigationProps = {
  groups: MenuCategory[];
  activeId?: string;
  query: string;
  onSelect: (id: string) => void;
  onSearch: (query: string) => void;
  restaurantName?: string;
};

function CategorySearch({
  query,
  onSearch,
  restaurantName,
  autoFocus = false,
}: Pick<NavigationProps, "query" | "onSearch" | "restaurantName"> & {
  autoFocus?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="search-input category-search-input flex w-full items-center gap-2">
      <svg
        className="h-4 w-4 shrink-0 opacity-70"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        autoFocus={autoFocus}
        type="search"
        value={query}
        onChange={(event) => onSearch(event.target.value)}
        placeholder={
          restaurantName
            ? `${t("searchIn")} ${restaurantName}…`
            : t("searchMenu")
        }
        className="min-w-0 flex-1 bg-transparent text-sm outline-none"
      />
    </div>
  );
}

function CategoryList({
  groups,
  activeId,
  onSelect,
}: Pick<NavigationProps, "groups" | "activeId" | "onSelect">) {
  const { menuLocale } = useMenuLanguage();

  return (
    <nav aria-label="Menu groups" className="space-y-1">
      {groups.map((group) => {
        const active = group.id === activeId;
        return (
          <button
            key={group.id}
            data-category-active={active ? "true" : undefined}
            type="button"
            aria-current={active ? "true" : undefined}
            onClick={() => onSelect(group.id)}
            className={clsx(
              "flex min-h-12 w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
              !active && "hover:bg-white/10",
            )}
            style={
              active
                ? {
                    color: "var(--cat-current-active-text)",
                    backgroundColor: "var(--cat-current-active-bg)",
                    outlineColor: "var(--cat-current-accent)",
                  }
                : {
                    color: "var(--cat-current-text)",
                    outlineColor: "var(--cat-current-accent)",
                  }
            }
          >
            {group.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={group.imageUrl}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full bg-white object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15 text-base uppercase"
              >
                {tField(group, "name", menuLocale).trim().charAt(0)}
              </span>
            )}
            <span className="min-w-0 flex-1 leading-5">
              {tField(group, "name", menuLocale)}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/** Desktop catalogue navigation. It remains visible while products scroll. */
export function CategorySidebar({
  groups,
  activeId,
  query,
  onSelect,
  onSearch,
  restaurantName,
  stickyTop,
  className,
}: NavigationProps & { stickyTop: number; className?: string }) {
  const { t } = useI18n();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = listRef.current;
    const active = container?.querySelector<HTMLElement>(
      '[data-category-active="true"]',
    );
    if (!container || !active) return;
    const nextTop =
      active.offsetTop - container.clientHeight / 2 + active.clientHeight / 2;
    const reducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    container.scrollTo({
      top: Math.max(0, nextTop),
      behavior: categoryScrollBehavior(!!reducedMotion),
    });
  }, [activeId]);

  return (
    <aside
      className={clsx("hidden xl:block", className)}
      aria-label={t("departments") || "Departments"}
    >
      <div
        className="sticky overflow-hidden rounded-2xl border shadow-sm"
        style={{
          ...categorySidebarStyle(),
          top: stickyTop,
          maxHeight: `calc(100dvh - ${stickyTop + 16}px)`,
        }}
      >
        <div
          className="border-b px-3 py-3"
          style={{ borderColor: "var(--cat-current-divider, currentColor)" }}
        >
          <p className="mb-2 px-1 text-xs font-bold uppercase tracking-[0.16em] opacity-70">
            {t("departments") || "Departments"}
          </p>
          <CategorySearch
            query={query}
            onSearch={onSearch}
            restaurantName={restaurantName}
          />
        </div>
        <div
          ref={listRef}
          className="overflow-y-auto p-2"
          style={{ maxHeight: `calc(100dvh - ${stickyTop + 112}px)` }}
        >
          <CategoryList
            groups={groups}
            activeId={activeId}
            onSelect={onSelect}
          />
        </div>
      </div>
    </aside>
  );
}

/** Mobile counterpart: a compact sticky trigger opening a full category drawer. */
export function CategoryDrawer({
  groups,
  activeId,
  query,
  onSelect,
  onSearch,
  restaurantName,
}: NavigationProps) {
  const { t, direction } = useI18n();
  const { menuLocale } = useMenuLanguage();
  const [open, setOpen] = useState(false);
  const activeGroup = groups.find((group) => group.id === activeId);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const selectAndClose = (id: string) => {
    onSelect(id);
    setOpen(false);
  };

  return (
    <div className="xl:hidden" style={categorySidebarStyle()}>
      <div
        className="flex items-center gap-3 border-b px-4 py-2.5"
        style={{ borderColor: "var(--cat-current-divider, currentColor)" }}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{
            color: "var(--cat-current-active-text)",
            backgroundColor: "var(--cat-current-active-bg)",
            outlineColor: "var(--cat-current-accent)",
          }}
        >
          <span className="truncate">
            {activeGroup
              ? tField(activeGroup, "name", menuLocale)
              : t("departments") || "Departments"}
          </span>
          <span className="shrink-0 text-xs font-medium opacity-75">
            {t("browseDepartments") || "Browse"} · {groups.length}
          </span>
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[90]" dir={direction}>
          <button
            type="button"
            aria-label={t("close") || "Close"}
            className="absolute inset-0 h-full w-full bg-black/60"
            onClick={() => setOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-drawer-title"
            className="absolute inset-x-0 bottom-0 flex max-h-[82dvh] flex-col rounded-t-3xl border-t shadow-2xl"
            style={categorySidebarStyle()}
          >
            <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
              <h2 id="category-drawer-title" className="text-lg font-bold">
                {t("departments") || "Departments"}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("close") || "Close"}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-xl"
              >
                ×
              </button>
            </div>
            <div className="px-4 pb-3">
              <CategorySearch
                query={query}
                onSearch={onSearch}
                restaurantName={restaurantName}
                autoFocus
              />
            </div>
            <div className="overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <CategoryList
                groups={groups}
                activeId={activeId}
                onSelect={selectAndClose}
              />
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
