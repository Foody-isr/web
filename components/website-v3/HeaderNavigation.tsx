"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import type { HeaderLink } from "@/lib/websiteHeader";
import { visibleHeaderLinks } from "@/lib/headerNavigation";

/** Keeps desktop navigation on one line and moves trailing links into an accessible overflow menu. */
export function HeaderNavigation({
  links,
  renderLink,
  moreLabel,
  label,
  uppercase,
  color,
}: {
  links: HeaderLink[];
  renderLink: (link: HeaderLink) => ReactNode;
  moreLabel: string;
  label: string;
  uppercase: boolean;
  color: string;
}) {
  const navRef = useRef<HTMLElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(0);
  useEffect(() => {
    const nav = navRef.current,
      measure = measureRef.current;
    if (!nav || !measure) return;
    const update = () => {
      const cells = Array.from(measure.children);
      const more = cells.pop();
      const gap = parseFloat(getComputedStyle(measure).columnGap) || 0;
      setVisible(
        visibleHeaderLinks(
          cells.map((cell) => cell.getBoundingClientRect().width),
          nav.clientWidth,
          gap,
          more?.getBoundingClientRect().width || 0,
        ),
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(nav);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [links, moreLabel]);
  return (
    <nav
      ref={navRef}
      className="website-header-links"
      data-header-element="navigation"
      data-header-label={label}
      aria-label={label}
      style={{
        textTransform: uppercase ? "uppercase" : undefined,
        color: color || undefined,
      }}
    >
      <div className="website-header-measure-clip" aria-hidden="true">
        <div ref={measureRef} className="website-header-measure">
          {links.map((link) => (
            <span key={link.id}>
              {link.label}
              {!!link.children?.length && (
                <ChevronDownIcon width={14} height={14} />
              )}
            </span>
          ))}
          <span>
            {moreLabel}
            <ChevronDownIcon width={14} height={14} />
          </span>
        </div>
      </div>
      <ul className="website-header-main-links">
        {links.slice(0, visible).map(renderLink)}
        {visible < links.length && (
          <li>
            <details className="website-header-submenu website-header-more">
              <summary>
                {moreLabel}
                <ChevronDownIcon width={14} height={14} />
              </summary>
              <ul>{links.slice(visible).map(renderLink)}</ul>
            </details>
          </li>
        )}
      </ul>
    </nav>
  );
}
