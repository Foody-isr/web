// Type definitions for the theme system.
// These mirror the Zod schemas in design-tokens/schemas.ts but are inlined here
// so foodyweb has no source-level dependency on the design-tokens directory
// (Vercel only sees the foodyweb root). Build-time validation against the
// schemas still happens in design-tokens/build.ts.

export type Direction = "ltr" | "rtl";
export type ViewMode = "compact" | "magazine";

export type ColorTokens = {
  bg: string;
  surface: string;
  surfaceMuted: string;
  ink: string;
  inkMuted: string;
  inkSoft: string;
  divider: string;
  accent: string;
  accentInk: string;
  success: string;
  warning: string;
  error: string;
};

export type RadiusTokens = {
  none: "0";
  sm: string;
  md: string;
  lg: string;
  xl: string;
  pill: "9999px";
};

export type SpacingScale = {
  unit: number;
  scale: number[];
};

export type ShadowTokens = {
  sm: string;
  md: string;
  lg: string;
  banner: string;
};

export type LayoutConfig = {
  hero: "fullbleed" | "centered-card" | "minimal-bar";
  banner: "image-overlay" | "text-block" | "striped-rule" | "none";
  itemDensityDefault: ViewMode;
  itemDensityToggle: boolean;
  cardImageRatio: "1:1" | "4:3" | "16:9";
  navStyle: "sticky-pills-top" | "sticky-pills-bottom" | "tabs-top";
  capitalizeBanners: boolean;
  itemCardElevation: "flat" | "subtle" | "raised";
};

export type SuggestedFor =
  | "fine-dining"
  | "casual"
  | "bar"
  | "food-truck"
  | "cafe"
  | "bakery";

export type Theme = {
  id: string;
  name: string;
  description: string;
  mode: "dark" | "light";
  preview: {
    swatches: [string, string, string, string];
    sampleImage: string;
  };
  suggestedFor: SuggestedFor[];
  tokens: {
    colors: ColorTokens;
    radius: RadiusTokens;
    spacing: SpacingScale;
    shadow: ShadowTokens;
  };
  layout: LayoutConfig;
};

export type FontDef = {
  family: string;
  weights: number[];
  googleFontsName?: string;
};

export type TypeStep = {
  size: string;
  lineHeight: string;
  letterSpacing: string;
  weight: number;
};

export type TypographyPairing = {
  id: string;
  name: string;
  description: string;
  pairing: {
    displayLatin: FontDef;
    bodyLatin: FontDef;
    displayHebrew: FontDef;
    bodyHebrew: FontDef;
  };
  scale: {
    displayXl: TypeStep;
    displayLg: TypeStep;
    headingMd: TypeStep;
    body: TypeStep;
    caption: TypeStep;
  };
};

export type ResolvedTheme = {
  themeId: string;
  pairingId: string;
  theme: Theme;
  pairing: TypographyPairing;
  brandColorOverride: string | null;
  direction: Direction;
  fonts: { display: string; body: string };
  layout: LayoutConfig;
};

export type PreviewMessage =
  | {
      type: "foody-theme-preview";
      themeId?: string;
      pairingId?: string;
      brandColor?: string | null;
      layoutDefault?: ViewMode;
      // Branding fields admin can edit and we want to see live in the iframe.
      logoSize?: number;
      hideNavbarName?: boolean;
      faviconURL?: string;
      direction?: Direction;
    }
  | { type: "foody-theme-clear" };
