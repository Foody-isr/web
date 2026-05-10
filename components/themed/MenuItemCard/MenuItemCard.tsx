"use client";

import type { MenuItem } from "@/lib/types";
import { Compact } from "./MenuItemCard.Compact";
import { Magazine } from "./MenuItemCard.Magazine";

export type MenuItemCardProps = {
  item: MenuItem;
  currencySymbol: string;
  density: "compact" | "magazine";
  isMostPopular?: boolean;
  onClick: () => void;
};

export function MenuItemCard(props: MenuItemCardProps) {
  return props.density === "magazine" ? <Magazine {...props} /> : <Compact {...props} />;
}
