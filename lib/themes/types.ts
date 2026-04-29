// Re-exports from design-tokens schemas, plus runtime-only types.
import type { z } from "zod";
import type { Theme as ThemeSchema, TypographyPairing as PairingSchema, LayoutConfig } from "../../../design-tokens/schemas";

export type Theme = z.infer<typeof ThemeSchema>;
export type TypographyPairing = z.infer<typeof PairingSchema>;
export type Direction = "ltr" | "rtl";
export type ViewMode = "compact" | "magazine";

export type ResolvedTheme = {
  themeId: string;
  pairingId: string;
  theme: Theme;
  pairing: TypographyPairing;
  brandColorOverride: string | null;
  direction: Direction;
  fonts: { display: string; body: string };
  layout: z.infer<typeof LayoutConfig>;
};

export type PreviewMessage =
  | {
      type: "foody-theme-preview";
      themeId: string;
      pairingId: string;
      brandColor: string | null;
      layoutDefault: ViewMode;
      direction: Direction;
    }
  | { type: "foody-theme-clear" };
