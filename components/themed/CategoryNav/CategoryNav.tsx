"use client";

import { useResolvedTheme } from "@/lib/themes/useResolvedTheme";
import { StickyPills } from "./CategoryNav.StickyPills";
import { TabsTop } from "./CategoryNav.TabsTop";

export type CategoryNavProps = {
  groups: { id: number | string; name: string }[];
  activeGroupId: number | string | null;
  onSelect: (id: number | string) => void;
};

export function CategoryNav(props: CategoryNavProps) {
  const { resolved } = useResolvedTheme();
  const style = resolved?.layout.navStyle ?? "sticky-pills-top";
  switch (style) {
    case "sticky-pills-top":    return <StickyPills {...props} position="top" />;
    case "sticky-pills-bottom": return <StickyPills {...props} position="bottom" />;
    case "tabs-top":            return <TabsTop {...props} />;
    default:                    return <StickyPills {...props} position="top" />;
  }
}
