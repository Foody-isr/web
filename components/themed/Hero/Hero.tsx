"use client";

import { useResolvedTheme } from "@/lib/themes/useResolvedTheme";
import { Fullbleed } from "./Hero.Fullbleed";
import { CenteredCard } from "./Hero.CenteredCard";
import { MinimalBar } from "./Hero.MinimalBar";

export type HeroProps = {
  imageUrl?: string;
  name: string;
  address?: string;
  tagline?: string;
};

export function Hero(props: HeroProps) {
  const { resolved } = useResolvedTheme();
  switch (resolved?.layout.hero) {
    case "fullbleed":      return <Fullbleed {...props} />;
    case "centered-card":  return <CenteredCard {...props} />;
    case "minimal-bar":    return <MinimalBar {...props} />;
    default:               return <Fullbleed {...props} />;
  }
}
