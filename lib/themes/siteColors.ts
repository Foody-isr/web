import {
  normalizeSiteColors,
  siteColorVariables,
  siteMenuColorVariables,
  SITE_MENU_COLOR_ROLES,
} from "../siteColors";
const roles = [
  "background",
  "title",
  "paragraph",
  "solid",
  "solid-ink",
  "outline",
  ...SITE_MENU_COLOR_ROLES.map((role) => `menu-${role.replaceAll("_", "-")}`),
];
/** Complete set of shared style properties, including the sparse selected style. */
export const SITE_COLOR_PROPERTY_NAMES = [
  ...["--site-default", ...[1, 2, 3, 4, 5, 6].map(n => `--style-${n}`)].flatMap(prefix => roles.map(role => `${prefix}-${role}`)),
  ...roles.map(role => `--site-${role}`),
];

/** Resolve shared styles once for both the server bootstrap and browser updates. */
export function siteColorProperties(palette: Record<string, unknown>): Record<string, string> {
  const properties: Record<string, string> = {};
  const colors = normalizeSiteColors(palette);
  for (const style of colors.styles) {
    const vars = { ...siteColorVariables(style), ...siteMenuColorVariables(style) };
    for (const role of roles) properties[`--${style.id}-${role}`] = vars[`--site-${role}`];
  }
  const selected = colors.styles.find(style => style.id === colors.default)!;
  const vars = { ...siteColorVariables(selected), ...siteMenuColorVariables(selected) };
  for (const role of roles) properties[`--site-default-${role}`] = vars[`--site-${role}`];
  if (palette.color_styles) Object.assign(properties, vars);
  return properties;
}
/** Clears owned color variables when navigating between restaurants or clearing a preview. */
export function clearSiteColors(): void {
  const root = document.documentElement;
  root.removeAttribute("data-site-colors");
  for (const name of SITE_COLOR_PROPERTY_NAMES) root.style.removeProperty(name);
}
/** Paints shared styles and the selected site default as one theme-owned update. */
export function applySiteColors(palette: Record<string, unknown>): void {
  clearSiteColors();
  const root = document.documentElement;
  if (palette.color_styles) root.setAttribute("data-site-colors", "true");
  for (const [key, value] of Object.entries(siteColorProperties(palette)))
    root.style.setProperty(key, value);
}
