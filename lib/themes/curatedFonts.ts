// Curated Google-Fonts library offered in the website builder's typography
// controls. The weights listed are the ones that actually exist for each
// family — we request exactly these when dynamically loading, because the
// Google Fonts css2 endpoint 400s if asked for a weight a family lacks.
//
// KEEP IN SYNC with foodyadmin/src/lib/website-fonts.ts (same families). The
// admin owns the picker UI; foodyweb only needs family → weights to load the
// font a restaurant selected. Custom-uploaded fonts (future) are not listed
// here and load via @font-face instead.

export type FontCategory = "sans" | "serif" | "display" | "handwriting";

export type CuratedFont = {
  family: string;
  category: FontCategory;
  weights: number[];
  /** True when the family ships Hebrew glyphs (safe for RTL menus). */
  supportsHebrew: boolean;
};

export const CURATED_FONTS: CuratedFont[] = [
  // ── Sans ──────────────────────────────────────────────────────────
  { family: "Inter", category: "sans", weights: [400, 500, 600, 700, 800], supportsHebrew: false },
  { family: "Poppins", category: "sans", weights: [400, 500, 600, 700, 800], supportsHebrew: false },
  { family: "Montserrat", category: "sans", weights: [400, 500, 600, 700, 800], supportsHebrew: false },
  { family: "Raleway", category: "sans", weights: [400, 500, 600, 700, 800], supportsHebrew: false },
  { family: "Nunito Sans", category: "sans", weights: [400, 600, 700, 800], supportsHebrew: false },
  { family: "Open Sans", category: "sans", weights: [400, 500, 600, 700, 800], supportsHebrew: true },
  { family: "Work Sans", category: "sans", weights: [400, 500, 600, 700], supportsHebrew: false },
  { family: "DM Sans", category: "sans", weights: [400, 500, 700], supportsHebrew: false },
  { family: "Manrope", category: "sans", weights: [400, 500, 600, 700, 800], supportsHebrew: false },
  { family: "Outfit", category: "sans", weights: [400, 500, 600, 700], supportsHebrew: false },
  { family: "Karla", category: "sans", weights: [400, 500, 600, 700], supportsHebrew: false },
  { family: "Mulish", category: "sans", weights: [400, 500, 600, 700], supportsHebrew: false },
  { family: "Rubik", category: "sans", weights: [400, 500, 600, 700], supportsHebrew: true },
  { family: "Heebo", category: "sans", weights: [400, 500, 600, 700, 800], supportsHebrew: true },
  { family: "Assistant", category: "sans", weights: [400, 500, 600, 700], supportsHebrew: true },
  // ── Serif ─────────────────────────────────────────────────────────
  { family: "Playfair Display", category: "serif", weights: [400, 500, 600, 700, 800], supportsHebrew: false },
  { family: "Cormorant Garamond", category: "serif", weights: [400, 500, 600, 700], supportsHebrew: false },
  { family: "Lora", category: "serif", weights: [400, 500, 600, 700], supportsHebrew: false },
  { family: "Merriweather", category: "serif", weights: [400, 700], supportsHebrew: false },
  { family: "Bitter", category: "serif", weights: [400, 500, 600, 700], supportsHebrew: false },
  { family: "Crimson Text", category: "serif", weights: [400, 600, 700], supportsHebrew: false },
  { family: "EB Garamond", category: "serif", weights: [400, 500, 600, 700], supportsHebrew: false },
  { family: "DM Serif Display", category: "serif", weights: [400], supportsHebrew: false },
  { family: "Frank Ruhl Libre", category: "serif", weights: [400, 500, 700, 900], supportsHebrew: true },
  { family: "David Libre", category: "serif", weights: [400, 500, 700], supportsHebrew: true },
  { family: "Suez One", category: "serif", weights: [400], supportsHebrew: true },
  // ── Display ───────────────────────────────────────────────────────
  { family: "Oswald", category: "display", weights: [400, 500, 600, 700], supportsHebrew: false },
  { family: "Bebas Neue", category: "display", weights: [400], supportsHebrew: false },
  { family: "Anton", category: "display", weights: [400], supportsHebrew: false },
  { family: "Abril Fatface", category: "display", weights: [400], supportsHebrew: false },
  { family: "Cinzel", category: "display", weights: [400, 500, 600, 700], supportsHebrew: false },
  { family: "Secular One", category: "display", weights: [400], supportsHebrew: true },
  // ── Handwriting / Script ──────────────────────────────────────────
  { family: "Dancing Script", category: "handwriting", weights: [400, 500, 600, 700], supportsHebrew: false },
  { family: "Great Vibes", category: "handwriting", weights: [400], supportsHebrew: false },
  { family: "Pacifico", category: "handwriting", weights: [400], supportsHebrew: false },
  { family: "Caveat", category: "handwriting", weights: [400, 500, 600, 700], supportsHebrew: false },
  { family: "Sacramento", category: "handwriting", weights: [400], supportsHebrew: false },
  { family: "Amatic SC", category: "handwriting", weights: [400, 700], supportsHebrew: true },
];

const WEIGHTS_BY_FAMILY: Record<string, number[]> = Object.fromEntries(
  CURATED_FONTS.map((f) => [f.family, f.weights]),
);

const INJECTED_FACES = new Set<string>();

/** Inject an @font-face for a custom (uploaded) font family (idempotent). Used
 *  for restaurant fonts that aren't on Google Fonts — the S3 `url` is the source
 *  and `format` is the CSS format() hint ('woff2' | 'woff' | 'truetype' |
 *  'opentype'). No-op on the server or for a family already injected. */
export function injectFontFace(family: string, url: string, format?: string): void {
  if (typeof document === "undefined" || !family || !url) return;
  if (INJECTED_FACES.has(family)) return;
  INJECTED_FACES.add(family);
  const style = document.createElement("style");
  const fmt = format ? ` format("${format}")` : "";
  style.textContent = `@font-face{font-family:"${family}";src:url("${url}")${fmt};font-display:swap;}`;
  document.head.appendChild(style);
}

/** Google Fonts css2 stylesheet URL for a family. Curated families use their
 *  declared weights; `extraWeights` (from the restaurant's typography
 *  extraFonts) covers Google Fonts the restaurant picked itself. Falls back to
 *  the no-axis form (default 400) for unknown families. */
export function googleFontUrl(family: string, extraWeights?: number[]): string {
  const weights = WEIGHTS_BY_FAMILY[family] ?? extraWeights;
  const base = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}`;
  if (!weights || weights.length === 0) return `${base}&display=swap`;
  return `${base}:wght@${[...weights].sort((a, b) => a - b).join(";")}&display=swap`;
}
