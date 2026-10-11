import type { CSSProperties } from "react";
import {
  resolveSiteColorStyle,
  resolveSiteItemColors,
  siteContrastInk,
} from "./siteColors";
import type { WebsiteOrderDesign } from "./websiteOrder";

/** Resolves the item sheet independently of checkout, using only global color styles. */
export function websiteItemAppearance(
  design: WebsiteOrderDesign,
  palette: unknown,
): CSSProperties {
  const style = resolveSiteColorStyle(
    palette,
    design.itemColorStyle === "default"
      ? design.colorStyle
      : design.itemColorStyle,
  );
  const variables: Record<string, string> = {
    "--item-width": { compact: "512px", standard: "600px", wide: "720px" }[
      design.itemWidth
    ],
    "--item-radius": { square: "0px", soft: "8px", rounded: "24px" }[
      design.itemRadius
    ],
  };
  if (!style) return variables as CSSProperties;
  const colors = resolveSiteItemColors(style);
  Object.assign(
    variables,
    Object.fromEntries(
      Object.entries(colors).map(([role, color]) => [
        `--item-${role.replaceAll("_", "-")}`,
        color,
      ]),
    ),
    {
      "--bg-page": colors.background,
      "--surface": colors.background,
      "--surface-subtle": `color-mix(in srgb, ${colors.title} 8%, ${colors.background})`,
      "--divider": `color-mix(in srgb, ${colors.title} 16%, transparent)`,
      "--text": colors.title,
      "--text-primary": colors.title,
      "--text-secondary": colors.description,
      "--text-soft": colors.description,
      "--text-muted": colors.description,
      "--brand": colors.selection_accent,
      "--item-selection-ink": siteContrastInk(colors.selection_accent),
    },
  );
  return variables as CSSProperties;
}
