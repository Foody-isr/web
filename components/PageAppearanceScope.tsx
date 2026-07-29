// Website Builder v2 — per-page appearance cascade (render side).
//
// Applies a page's appearance overrides (set in the builder) as CSS custom
// properties that override the global theme for this page only — the site→page
// cascade. Maps the builder's keys to foodyweb's theme vars (see applyTheme.ts):
//   bg → --bg-page, ink → --text, accent → --brand/--accent,
//   headingFont → --font-display, bodyFont → --font-body.
//
// Uses display:contents so it overrides the tokens without adding a layout box.
// Custom properties still inherit through a display:contents element in modern
// browsers, so descendants (OrderExperience, CateringExperience, sections) pick
// them up. Renders children untouched when there's nothing to override.

import { CSSProperties, ReactNode } from "react";
import type { WebsitePageSettings } from "@/lib/websiteV2Api";

export function PageAppearanceScope({
  appearance,
  children,
}: {
  appearance: WebsitePageSettings["appearance"];
  children: ReactNode;
}) {
  const a = appearance || {};
  const vars: Record<string, string> = {};
  if (a.bg) vars["--bg-page"] = a.bg;
  if (a.ink) vars["--text"] = a.ink;
  if (a.accent) {
    vars["--brand"] = a.accent;
    vars["--accent"] = a.accent;
  }
  if (a.headingFont) vars["--font-display"] = `"${a.headingFont}"`;
  if (a.bodyFont) vars["--font-body"] = `"${a.bodyFont}"`;

  if (Object.keys(vars).length === 0) return <>{children}</>;

  return (
    <div style={{ display: "contents", ...(vars as CSSProperties) }}>{children}</div>
  );
}
