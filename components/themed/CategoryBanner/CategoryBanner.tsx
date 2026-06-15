"use client";

import { useResolvedTheme } from "@/lib/themes/useResolvedTheme";
import { useIsMobileViewport } from "@/lib/themes/useViewMode";
import { ImageOverlay } from "./CategoryBanner.ImageOverlay";
import { TextBlock } from "./CategoryBanner.TextBlock";
import { StripedRule } from "./CategoryBanner.StripedRule";

export type CategoryBannerProps = {
  name: string;
  imageUrl?: string;
  description?: string;
  capitalize?: boolean;
  /** Darkness (0-100) of the dark veil over the image. Only used by ImageOverlay. */
  overlay?: number;
  /** How the image fills the banner box: "cover" (crop, default), "contain" (whole image + blurred fill), or "natural" (full-width at the image's own aspect ratio). Only used by ImageOverlay. */
  fit?: "cover" | "contain" | "natural";
  /** When true, the image is shown with no overlaid title/veil (the "image-only" style). Only used by ImageOverlay. */
  hideTitle?: boolean;
};

export function CategoryBanner(props: CategoryBannerProps) {
  const { resolved, config } = useResolvedTheme();
  // Image-overlay is the product default. Admin can override per-restaurant.
  const style = config?.categoryBannerStyle ?? "image-overlay";
  const capitalize = props.capitalize ?? resolved?.layout.capitalizeBanners ?? false;
  // Default 40 preserves the legacy bg-black/40 veil; admin can dial it 0-100.
  const overlay = config?.categoryBannerOverlay ?? 40;
  // Fit is configured per device; the mobile value falls back to the desktop
  // choice when unset (empty string). `||` (not `??`) so the admin preview's
  // '' "no override" sentinel resolves to the desktop value. Starts
  // desktop-first on the server, resolves to mobile after mount.
  const isMobile = useIsMobileViewport();
  const fit = (isMobile ? config?.categoryBannerFitMobile : null) || config?.categoryBannerFit || "cover";
  const merged = { ...props, capitalize, overlay, fit };
  switch (style) {
    case "image-overlay": return <ImageOverlay {...merged} />;
    case "image-only":    return <ImageOverlay {...merged} hideTitle />;
    case "text-block":    return <TextBlock {...merged} />;
    case "striped-rule":  return <StripedRule {...merged} />;
    case "none":          return null;
    default:              return <ImageOverlay {...merged} />;
  }
}
