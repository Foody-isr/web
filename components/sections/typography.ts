/** Shared typography helpers for section components. */

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

export function getHeadingClass(settings?: Record<string, any>): string {
  const size = settings?.heading_size || "md";
  const weight = settings?.font_weight || "bold";
  return `${HEADING_SIZES[size] || HEADING_SIZES.md} ${weight === "bold" ? "font-bold" : FONT_WEIGHTS[weight] || "font-bold"}`;
}

export function getBodyClass(settings?: Record<string, any>): string {
  const size = settings?.body_size || "md";
  return `${BODY_SIZES[size] || BODY_SIZES.md} leading-relaxed`;
}
