"use client";

import Link from "next/link";
import { SectionProps } from "./SectionRenderer";
import { getSectionBg } from "./sectionBg";

type ActionButton = {
  label: string;
  action: "order_pickup" | "order_delivery" | "view_menu" | "external_link" | "scroll_to_section";
  target?: string;
  style?: "primary" | "secondary" | "outline";
};

/**
 * Configurable action buttons section with links to order modes, menu, or external URLs.
 * Content: { buttons: ActionButton[] }
 */
export function ActionButtonsSection({ section, restaurant }: SectionProps) {
  const buttons: ActionButton[] = section.content.buttons || [];
  const slug = restaurant.slug || String(restaurant.id);
  const bg = getSectionBg(section.settings);

  if (buttons.length === 0) return null;

  return (
    <section className={`relative py-12 px-6 ${bg.className}`} style={bg.style}>
      <div className="relative z-10 max-w-3xl mx-auto flex flex-wrap items-center justify-center gap-4">
        {buttons.map((btn, idx) => {
          const href = getButtonHref(btn, slug);
          const isExternal = btn.action === "external_link";
          const btnStyle = btn.style || "primary";

          const className =
            btnStyle === "primary"
              ? "px-8 py-3.5 rounded-full bg-[var(--brand)] text-white font-semibold text-base hover:opacity-90 transition-opacity"
              : btnStyle === "outline"
                ? "px-8 py-3.5 rounded-full border-2 border-[var(--brand)] text-[var(--brand)] font-semibold text-base hover:bg-[var(--brand)] hover:text-white transition-all"
                : "px-8 py-3.5 rounded-full bg-[var(--surface-subtle)] text-[var(--text)] font-semibold text-base hover:bg-[var(--surface-elevated)] transition-colors";

          if (btn.action === "scroll_to_section" && btn.target) {
            return (
              <a
                key={idx}
                href={`#${btn.target}`}
                className={className}
              >
                {btn.label}
              </a>
            );
          }

          if (isExternal && btn.target) {
            return (
              <a
                key={idx}
                href={btn.target}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
              >
                {btn.label}
              </a>
            );
          }

          return (
            <Link key={idx} href={href} className={className}>
              {btn.label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function getButtonHref(btn: ActionButton, slug: string): string {
  switch (btn.action) {
    case "order_pickup":
      return `/r/${slug}/order?type=pickup`;
    case "order_delivery":
      return `/r/${slug}/order?type=delivery`;
    case "view_menu":
      return `/r/${slug}/order`;
    case "external_link":
      return btn.target || "#";
    case "scroll_to_section":
      return `#${btn.target || ""}`;
    default:
      return `/r/${slug}/order`;
  }
}
