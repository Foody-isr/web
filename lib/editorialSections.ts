/** Layouts supported by the text-and-image editor and storefront. */
export const TEXT_IMAGE_LAYOUTS = [
  "image_left",
  "default",
  "columns",
  "columns_title_top",
  "columns_centered",
  "highlight",
  "image_above",
  "full_width",
  "split_right",
  "split_left",
  "background",
  "overlap",
] as const;

/** Resolves historic starter settings without changing saved content or visibility. */
export function textImageLayout(
  layout: unknown,
  settings: Record<string, any>,
  content: Record<string, any>,
): string {
  if (settings.image_only) return "full_width";
  if (
    TEXT_IMAGE_LAYOUTS.includes(layout as (typeof TEXT_IMAGE_LAYOUTS)[number])
  )
    return String(layout);
  return content.image_position === "left" ? "image_left" : "default";
}

/** Keeps the historic first group flat and accepts independent additional groups. */
export function textImageGroups(
  content: Record<string, any>,
): Record<string, any>[] {
  return [
    content,
    ...(Array.isArray(content.groups)
      ? content.groups.filter(
          (group) =>
            group && typeof group === "object" && !Array.isArray(group),
        )
      : []),
  ];
}

/** One typography scale for starter marquees and manually added sections. */
export function scrollingTextTypography(settings: Record<string, any>) {
  const legacyDisplay = settings.theme_layout === "youngs-place";
  const sizes: Record<string, string> = {
    sm: "clamp(20px, 2vw, 28px)",
    md: "clamp(28px, 4vw, 48px)",
    lg: "clamp(40px, 6vw, 80px)",
    xl: "clamp(48px, 8vw, 112px)",
  };
  return {
    fontSize: sizes[settings.text_size] || sizes[legacyDisplay ? "xl" : "sm"],
    fontFamily: settings.text_font
      ? `"${settings.text_font}", sans-serif`
      : settings.text_font_role === "body"
        ? "var(--font-body), sans-serif"
        : "var(--font-display), sans-serif",
    fontWeight:
      { normal: 400, medium: 500, bold: 700 }[
        settings.text_weight as "normal" | "medium" | "bold"
      ] ?? 700,
    textTransform:
      settings.text_uppercase === true ||
      (settings.text_uppercase == null && legacyDisplay)
        ? ("uppercase" as const)
        : ("none" as const),
  };
}
