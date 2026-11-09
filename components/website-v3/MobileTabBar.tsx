"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import {
  HeartIcon, InformationCircleIcon, LinkIcon, ReceiptPercentIcon, ShoppingBagIcon, StarIcon,
} from "@heroicons/react/24/outline";
import type { MobileIcon, MobileNavigationColors, MobileNavigationItem } from "@/lib/mobileExperience";

const outlines = {
  home: <path d="M3.6 12.6c0-.9.4-1.8 1.1-2.4l7.4-6.4a2.9 2.9 0 0 1 3.8 0l7.4 6.4c.7.6 1.1 1.5 1.1 2.4v9.1a3.1 3.1 0 0 1-3.1 3.1h-4.4v-5.3a2.9 2.9 0 0 0-5.8 0v5.3H6.7a3.1 3.1 0 0 1-3.1-3.1Z" />,
  order: <>
    <rect x="4.8" y="3.2" width="18.4" height="21.6" rx="3.1" />
    <path d="M13 9.2h5.6M13 14h5.6M13 18.8h5.6" />
    <g fill="currentColor" stroke="none">
      <circle cx="9.5" cy="9.2" r=".85" /><circle cx="9.5" cy="14" r=".85" /><circle cx="9.5" cy="18.8" r=".85" />
    </g>
  </>,
  gift: <>
    <path d="M4.5 14v7.5a3.2 3.2 0 0 0 3.2 3.2h12.6a3.2 3.2 0 0 0 3.2-3.2V14M3.2 14V9.5a1.4 1.4 0 0 1 1.4-1.4h18.8a1.4 1.4 0 0 1 1.4 1.4V14ZM14 8.1v16.6" />
    <path d="M14 8.1c-1.8-2.4-2.5-4.9-4.8-4.9a2.5 2.5 0 1 0 0 4.9H14Zm0 0c1.8-2.4 2.5-4.9 4.8-4.9a2.5 2.5 0 1 1 0 4.9H14Z" />
  </>,
  drink: <path d="M5.6 8.6h16.8l-1.8 14a2.3 2.3 0 0 1-2.3 2.1H9.7a2.3 2.3 0 0 1-2.3-2.1L5.6 8.6Zm.6 4.7h15.6M4.8 8.6h18.4M14 8.6l1.1-4a1.9 1.9 0 0 1 1.8-1.4h3" />,
  more: <g fill="currentColor" stroke="none">
    <circle cx="4.8" cy="14" r="1.48" /><circle cx="14" cy="14" r="1.48" /><circle cx="23.2" cy="14" r="1.48" />
  </g>,
} satisfies Partial<Record<MobileIcon, ReactNode>>;

const otherIcons = {
  receipt: ReceiptPercentIcon, bag: ShoppingBagIcon, info: InformationCircleIcon,
  heart: HeartIcon, star: StarIcon, link: LinkIcon,
};

/** Draws the configured pictogram at the size of its navigation surface. */
export function MobileNavigationIcon({ icon, size = 28 }: { icon: MobileIcon; size?: number }) {
  if (icon in outlines) {
    return (
      <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
        <g className="mobile-nav-outline" fill="none" stroke="currentColor" strokeWidth="1.24" strokeLinecap="round" strokeLinejoin="round">
          {outlines[icon as keyof typeof outlines]}
        </g>
      </svg>
    );
  }
  const Icon = otherIcons[icon as keyof typeof otherIcons];
  return <Icon width={size} height={size} aria-hidden="true" />;
}

type TabEntry = {
  item: MobileNavigationItem;
  label: string;
  href: string;
  icon: MobileIcon;
  external: boolean;
};

// The storefront mounts a new page surface between routes. Keep the origin of a
// recent tab press long enough for that surface to animate its selection.
let lastTabPress: { scope: string; from: string; to: string; at: number } | undefined;

function selectionFrame(nav: HTMLElement, link: HTMLAnchorElement) {
  const edge = 4;
  const label = link.querySelector<HTMLElement>(".mobile-tabbar-label");
  const available = Math.max(0, nav.clientWidth - 2 * edge);
  const expansion = nav.dataset.tabs === "5" ? 16 : 8;
  const width = Math.min(available, Math.max(link.offsetWidth + expansion, (label?.offsetWidth ?? 0) + 36));
  const x = Math.max(edge, Math.min(link.offsetLeft + (link.offsetWidth - width) / 2, nav.clientWidth - width - edge));
  return { width: `${width}px`, transform: `translateX(${x}px)` };
}

/** Renders the installed app's bottom navigation and its moving selection. */
export function MobileTabBar({ tabs, activeId, colors, label, dir, scope, onTabClick }: {
  tabs: TabEntry[];
  activeId?: string;
  colors?: MobileNavigationColors;
  label: string;
  dir: "ltr" | "rtl";
  scope: string;
  onTabClick?: (event: MouseEvent<HTMLAnchorElement>, entry: TabEntry) => void;
}) {
  const navRef = useRef<HTMLElement>(null);
  const selectionRef = useRef<HTMLSpanElement>(null);
  const previousId = useRef<string>(undefined);
  const tabOrder = tabs.map(({ item }) => item.id).join("|");

  useLayoutEffect(() => {
    const nav = navRef.current;
    const selection = selectionRef.current;
    const selected = nav?.querySelector<HTMLAnchorElement>("a[aria-current='page']");
    const previous = previousId.current;
    previousId.current = activeId;
    if (!nav || !selection || !selected) return;

    const press = lastTabPress;
    const followsPress = press?.scope === scope && press.to === activeId && performance.now() - press.at < 15_000;
    if (followsPress) lastTabPress = undefined;
    const fromId = followsPress ? press.from : previous;
    const update = () => Object.assign(selection.style, selectionFrame(nav, selected));
    update();

    if (fromId && fromId !== activeId && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const from = Array.from(nav.querySelectorAll<HTMLAnchorElement>("[data-mobile-tab]"))
        .find(link => link.dataset.mobileTab === fromId);
      if (from) {
        selection.getAnimations().forEach(animation => animation.cancel());
        selection.animate([selectionFrame(nav, from), selectionFrame(nav, selected)], {
          duration: 310, easing: "cubic-bezier(.22,.85,.26,1)",
        });
      }
      selected.querySelector(".mobile-tabbar-icon")?.animate(
        [{ transform: "scale(.91)" }, { transform: "scale(1.08)", offset: .57 }, { transform: "scale(1)" }],
        { duration: 285, easing: "ease-out" },
      );
    }
    const observer = new ResizeObserver(update);
    observer.observe(nav);
    observer.observe(selected);
    const selectedLabel = selected.querySelector(".mobile-tabbar-label");
    if (selectedLabel) observer.observe(selectedLabel);
    return () => observer.disconnect();
  }, [activeId, dir, scope, tabOrder]);

  return (
    <nav ref={navRef} aria-label={label} className="mobile-tabbar" dir={dir} data-tabs={tabs.length}
      style={{
        "--mobile-nav-bg": colors?.background,
        "--mobile-nav-glass-opacity": colors?.background ? "84%" : undefined,
        "--mobile-nav-border": colors?.border,
        "--mobile-nav-fg": colors?.foreground,
        "--mobile-nav-icon": colors?.icon,
        "--mobile-nav-active-bg": colors?.active_background,
        "--mobile-nav-active-fg": colors?.active_foreground,
        "--mobile-nav-active-icon": colors?.active_icon,
        "--mobile-nav-accent": colors?.accent,
      } as CSSProperties}>
      <span ref={selectionRef} className="mobile-tabbar-selection" aria-hidden="true" hidden={!activeId} />
      {tabs.map(entry => {
        const { item, href, icon, label, external } = entry;
        return (
          <Link key={item.id} href={href} aria-current={activeId === item.id ? "page" : undefined} prefetch={false}
            data-mobile-tab={item.id}
            onClick={event => {
              if (activeId && activeId !== item.id && !external && event.button === 0
                && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                lastTabPress = { scope, from: activeId, to: item.id, at: performance.now() };
              }
              onTabClick?.(event, entry);
            }}>
            <span className="mobile-tabbar-content">
              <span className="mobile-tabbar-icon" data-icon={icon}>
                <svg className="mobile-tabbar-accent" viewBox="0 0 28 28" aria-hidden="true">
                  <path d="M2.2 6.3C4.4 1.2 8.6.4 12.1 1.8c3.6 1.4 3.5 4.3 6.4 6.7 2.8 2.2 6.8 1.2 8.5 5.3 1.7 4.4-2.2 8.5-6.5 11.1-5 3-11.3 1.9-15.6-1.1C.3 20.6-.8 13.4 2.2 6.3Z" />
                </svg>
                <MobileNavigationIcon icon={icon} />
              </span>
              <span className="mobile-tabbar-label">{label}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
