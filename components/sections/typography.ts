/** Shared typography helpers for section components. */

import { CSSProperties } from "react";

const HEADING_SIZES: Record<string, string> = {
  sm: "text-xl md:text-2xl",
  md: "text-2xl md:text-3xl",
  lg: "text-3xl md:text-4xl",
  xl: "text-4xl md:text-5xl",
};

const BODY_SIZES: Record<string, string> = {
  sm: "text-sm",
  md: "text-base md:text-lg",
  lg: "text-lg md:text-xl",
};

const FONT_WEIGHTS: Record<string, string> = {
  normal: "font-normal",
  medium: "font-medium",
  bold: "font-bold",
};

const WEIGHT_MAP: Record<string, number> = { normal: 400, medium: 500, bold: 700 };

export function getHeadingClass(settings?: Record<string, any>): string {
  const size = settings?.heading_size || "md";
  const weight = settings?.font_weight || "bold";
  return `${HEADING_SIZES[size] || HEADING_SIZES.md} ${weight === "bold" ? "font-bold" : FONT_WEIGHTS[weight] || "font-bold"}`;
}

export function getBodyClass(settings?: Record<string, any>): string {
  const size = settings?.body_size || "md";
  return `${BODY_SIZES[size] || BODY_SIZES.md} leading-relaxed`;
}

/**
 * Per-field inline style from settings.
 * Keys: `{prefix}_color`, `{prefix}_font`, `{prefix}_weight`.
 */
export function getFieldStyle(settings: Record<string, any>, prefix: string): CSSProperties {
  const style: CSSProperties = {};
  if (settings[`${prefix}_color`]) style.color = settings[`${prefix}_color`];
  if (settings[`${prefix}_font`]) style.fontFamily = `"${settings[`${prefix}_font`]}", sans-serif`;
  if (settings[`${prefix}_weight`]) style.fontWeight = WEIGHT_MAP[settings[`${prefix}_weight`]] || 400;
  return style;
}

/**
 * Per-field size class from settings.
 * Key: `{prefix}_size`.
 */
export function getFieldSizeClass(settings: Record<string, any>, prefix: string, isHeading: boolean): string {
  const size = settings[`${prefix}_size`] || "md";
  return isHeading ? (HEADING_SIZES[size] || HEADING_SIZES.md) : (BODY_SIZES[size] || BODY_SIZES.md);
}

/** Google Font URLs for dynamic loading. */
export const FONT_URLS: Record<string, string> = {
  "Nunito Sans": "https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap",
  "Inter": "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap",
  "Poppins": "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap",
  "Rubik": "https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;600;700;800&display=swap",
  "Open Sans": "https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700;800&display=swap",
  "Playfair Display": "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800&display=swap",
  "Cinzel Decorative": "https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&display=swap",
  "Cormorant Garamond": "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap",
  "Lora": "https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap",
  "Montserrat": "https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap",
  "Oswald": "https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&display=swap",
  "Raleway": "https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700;800&display=swap",
  "Dancing Script": "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;500;600;700&display=swap",
  "Great Vibes": "https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap",
  "Merriweather": "https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,300;0,400;0,700;0,900;1,400&display=swap",
  "Bitter": "https://fonts.googleapis.com/css2?family=Bitter:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap",
  "Crimson Text": "https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400&display=swap",
};

/** Fonts loaded via @font-face in globals.css (no dynamic link needed). */
const SELF_HOSTED_FONTS = new Set(["Eros"]);

/** Load a Google Font dynamically if not already loaded. Self-hosted fonts are skipped (already in CSS). */
export function ensureFont(fontName?: string) {
  if (!fontName) return;
  if (SELF_HOSTED_FONTS.has(fontName)) return;
  const url = FONT_URLS[fontName];
  if (url && typeof document !== "undefined" && !document.querySelector(`link[href="${url}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    document.head.appendChild(link);
  }
}
