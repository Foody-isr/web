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
import { pageAppearanceVariables } from "@/lib/websiteV3Appearance";

type Appearance =
  | WebsitePageSettings["appearance"]
  | Record<string, unknown>
  | null
  | undefined;

export function PageAppearanceScope({
  appearance,
  children,
}: {
  appearance: Appearance;
  children: ReactNode;
}) {
  const vars = pageAppearanceVariables(appearance);

  if (Object.keys(vars).length === 0) return <>{children}</>;

  return (
    <div style={{ display: "contents", ...(vars as CSSProperties) }}>{children}</div>
  );
}
