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
};

export function CategoryBanner(props: CategoryBannerProps) {
  const { resolved } = useResolvedTheme();
  const style = resolved?.layout.banner ?? "text-block";
  const capitalize = props.capitalize ?? resolved?.layout.capitalizeBanners ?? false;
  const merged = { ...props, capitalize };
  switch (style) {
    case "image-overlay": return <ImageOverlay {...merged} />;
    case "text-block":    return <TextBlock {...merged} />;
    case "striped-rule":  return <StripedRule {...merged} />;
    case "none":          return null;
    default:              return <TextBlock {...merged} />;
  }
}
