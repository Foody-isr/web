"use client";

import { useResolvedTheme } from "@/lib/themes/useResolvedTheme";
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
};

export function CategoryBanner(props: CategoryBannerProps) {
  const { resolved, config } = useResolvedTheme();
  // Image-overlay is the product default. Admin can override per-restaurant.
  const style = config?.categoryBannerStyle ?? "image-overlay";
  const capitalize = props.capitalize ?? resolved?.layout.capitalizeBanners ?? false;
  // Default 40 preserves the legacy bg-black/40 veil; admin can dial it 0-100.
  const overlay = config?.categoryBannerOverlay ?? 40;
  const merged = { ...props, capitalize, overlay };
  switch (style) {
    case "image-overlay": return <ImageOverlay {...merged} />;
    case "text-block":    return <TextBlock {...merged} />;
    case "striped-rule":  return <StripedRule {...merged} />;
    case "none":          return null;
    default:              return <ImageOverlay {...merged} />;
  }
}
