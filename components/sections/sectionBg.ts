/** Shared background helpers for section components. */

import { CSSProperties, ReactNode } from "react";

const COLOR_CLASSES: Record<string, string> = {
  brand: "bg-[var(--brand)] text-white",
  light: "bg-[var(--surface)] text-[var(--text)]",
  dark: "bg-gray-900 text-white",
};

type SectionBgResult = {
  /** Tailwind classes for the section element (empty when custom/image) */
  className: string;
  /** Inline styles for the section element */
  style: CSSProperties;
  /** Whether a background image is set */
  hasBgImage: boolean;
  /** Overlay style (position it as an absolute child inside the section) */
  overlayStyle: CSSProperties | null;
};

/**
 * Compute background className, style, and overlay for a section.
 *
 * Usage in a section component:
 * ```tsx
 * const bg = getSectionBg(section.settings);
 * return (
 *   <section className={`relative ${bg.className}`} style={bg.style}>
 *     {bg.overlayStyle && <div className="absolute inset-0 z-0" style={bg.overlayStyle} />}
 *     <div className="relative z-10">...content...</div>
 *   </section>
 * );
 * ```
 */
export function getSectionBg(
  settings?: Record<string, any>,
  defaultColorStyle: string = "light"
): SectionBgResult {
  const s = settings || {};
  const colorStyle = s.color_style || defaultColorStyle;
  const isCustom = colorStyle === "custom";
  const bgImage = s.bg_image || "";

  // Base className (tailwind color classes)
  let className = "";
  const style: CSSProperties = {};

  if (bgImage) {
    // Background image mode — use inline styles for bg
    const bgSize = s.bg_size || "cover";
    style.backgroundImage = `url(${bgImage})`;
    style.backgroundPosition = s.bg_position || "center";
    style.backgroundRepeat = bgSize === "repeat" ? "repeat" : "no-repeat";
    style.backgroundSize = bgSize === "repeat" ? "auto" : bgSize;

    // If custom colors set, apply them as fallback/text color
    if (isCustom) {
      if (s.custom_bg) style.backgroundColor = s.custom_bg;
      if (s.custom_text) style.color = s.custom_text;
    } else if (colorStyle === "dark") {
      style.color = "#ffffff";
    }
  } else if (isCustom) {
    // Custom color mode — no image
    if (s.custom_bg) style.backgroundColor = s.custom_bg;
    if (s.custom_text) style.color = s.custom_text;
  } else {
    // Standard color class mode
    className = COLOR_CLASSES[colorStyle] || COLOR_CLASSES.light;
  }

  // Overlay (only when background image is set and overlay is enabled)
  let overlayStyle: CSSProperties | null = null;
  if (bgImage && s.bg_overlay) {
    const overlayColor = s.bg_overlay_color || "#000000";
    const overlayOpacity = (s.bg_overlay_opacity ?? 50) / 100;
    overlayStyle = {
      backgroundColor: overlayColor,
      opacity: overlayOpacity,
    };
  }

  return { className, style, hasBgImage: !!bgImage, overlayStyle };
}
