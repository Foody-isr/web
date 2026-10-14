import type { ResolvedTheme } from "./types";
import type { WebsiteConfig } from "../types";
import { sectionColorVariables, themeVariables, THEME_PROPERTY_NAMES } from "./applyTheme";
import { siteColorProperties, SITE_COLOR_PROPERTY_NAMES } from "./siteColors";

/** Preserve a deeper server-painted page while its parent hydrates first. */
export function claimThemeBootstrap(depth: number): boolean {
  const root = document.documentElement;
  const pendingDepth = Number(root.dataset.foodyThemeDepth || 0);
  if (pendingDepth > depth && document.querySelector(`script[data-restaurant-theme="${pendingDepth}"]`)) return false;
  delete root.dataset.foodyThemeDepth;
  return true;
}

/** Paint the resolved public theme before its HTML can display the Foody defaults. */
export function themeBootstrapScript(resolved: ResolvedTheme, config: WebsiteConfig | null, depth: number): string {
  const c = resolved.theme.tokens.colors;
  const palette = { bg: c.bg, ink: c.ink, accent: resolved.brandColorOverride || c.accent, surface: c.surface, ...config?.customPalette };
  const state = JSON.stringify({
    depth,
    attrs: {
      "data-theme": resolved.themeId,
      "data-pairing": resolved.pairingId,
      "dir": resolved.direction,
      "data-site-design": resolved.typography?.site ? resolved.typography.site.template || "custom" : null,
      "data-site-colors": palette.color_styles ? "true" : null,
    },
    clear: [...THEME_PROPERTY_NAMES, ...SITE_COLOR_PROPERTY_NAMES],
    vars: { ...themeVariables(resolved), ...siteColorProperties(palette), ...sectionColorVariables(config?.sectionColors) },
  }).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  return `((s)=>{const r=document.documentElement;if(Number(r.dataset.foodyThemeDepth||0)>s.depth)return;for(const n of s.clear)r.style.removeProperty(n);for(const [n,v]of Object.entries(s.attrs))v===null?r.removeAttribute(n):r.setAttribute(n,v);for(const [n,v]of Object.entries(s.vars))r.style.setProperty(n,v);r.dataset.foodyThemeDepth=String(s.depth)})(${state})`;
}
