/** Shared background helpers for section components. */

import { CSSProperties } from "react";

const COLOR_CLASSES: Record<string, string> = {
  brand: "bg-[var(--brand)] text-white",
  light: "bg-[var(--surface)] text-[var(--text)]",
  dark: "bg-gray-900 text-white",
};

/** Convert hex color + opacity (0-1) to an rgba() string. */
function hexToRgba(hex: string, opacity: number): string {
  const c = hex.replace("#", "");
  if (c.length !== 6) return `rgba(0,0,0,${opacity})`;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

type SectionBgResult = {
  /** Tailwind classes for the section element (empty when custom/image) */
  className: string;
  /** Inline styles for the section element (includes baked-in overlay as gradient layer) */
  style: CSSProperties;
  /** Whether a background image is set */
  hasBgImage: boolean;
  /**
   * @deprecated Overlay is now baked into style.backgroundImage as a gradient layer.
   * Kept for backward compat — always null for new code.
   */
  overlayStyle: CSSProperties | null;
};

/**
 * Compute background className and style for a section.
 *
 * When an overlay is enabled, it is baked directly into the CSS `background-image`
 * as a linear-gradient layer on top of the image URL. This eliminates the need for
 * a separate overlay div and all z-index stacking issues.
 *
 * Usage in a section component:
 * ```tsx
 * const bg = getSectionBg(section.settings);
 * return (
 *   <section className={`relative ${bg.className}`} style={bg.style}>
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

    // If overlay is enabled, bake it as a gradient layer on top of the image
    if (s.bg_overlay) {
      const overlayColor = s.bg_overlay_color || "#000000";
      const overlayOpacity = (s.bg_overlay_opacity ?? 50) / 100;
      const rgba = hexToRgba(overlayColor, overlayOpacity);
      style.backgroundImage = `linear-gradient(${rgba}, ${rgba}), url(${bgImage})`;
    } else {
      style.backgroundImage = `url(${bgImage})`;
    }

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

  return { className, style, hasBgImage: !!bgImage, overlayStyle: null };
}
