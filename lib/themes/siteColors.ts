import { normalizeSiteColors, siteColorVariables } from "../siteColors";
const roles = [
  "background",
  "title",
  "paragraph",
  "solid",
  "solid-ink",
  "outline",
];
/** Clears owned color variables when navigating between restaurants or clearing a preview. */
export function clearSiteColors(): void {
  const root = document.documentElement;
  root.removeAttribute("data-site-colors");
  for (const prefix of [
    "--site-default",
    ...[1, 2, 3, 4, 5, 6].map((n) => `--style-${n}`),
  ])
    for (const role of roles) root.style.removeProperty(`${prefix}-${role}`);
  for (const role of roles) root.style.removeProperty(`--site-${role}`);
}
/** Paints shared styles and the selected site default as one theme-owned update. */
export function applySiteColors(palette: Record<string, unknown>): void {
  clearSiteColors();
  const root = document.documentElement,
    colors = normalizeSiteColors(palette);
  for (const style of colors.styles) {
    const vars = siteColorVariables(style);
    for (const role of roles)
      root.style.setProperty(`--${style.id}-${role}`, vars[`--site-${role}`]);
  }
  const selected = colors.styles.find((style) => style.id === colors.default)!;
  const vars = siteColorVariables(selected);
  for (const role of roles)
    root.style.setProperty(`--site-default-${role}`, vars[`--site-${role}`]);
  if (!palette.color_styles) return;
  root.setAttribute("data-site-colors", "true");
  for (const [key, value] of Object.entries(vars))
    root.style.setProperty(key, value);
}
