"use client";

/* Visual-regression sandbox.
 * Renders all 8 themes × LTR/RTL with the variants each theme prescribes.
 * Each panel is wrapped in a <div data-theme=… dir=…> so the generated
 * themes.css CSS vars cascade to its descendants. We render the variant
 * components directly (Hero.Fullbleed, CategoryNav.StickyPills, etc.) so
 * panels don't need their own ResolvedThemeProvider — useResolvedTheme()
 * is only consumed by the variant-switch wrappers we bypass here.
 *
 * Used by tests/visual/grid.spec.ts.
 */

import { themes, pairingsById } from "@/lib/themes/generated/themes";
import type { Theme, TypographyPairing, LayoutConfig } from "@/lib/themes/types";
import type { MenuItem } from "@/lib/types";

import { Fullbleed } from "@/components/themed/Hero/Hero.Fullbleed";
import { CenteredCard } from "@/components/themed/Hero/Hero.CenteredCard";
import { MinimalBar } from "@/components/themed/Hero/Hero.MinimalBar";

import { ImageOverlay } from "@/components/themed/CategoryBanner/CategoryBanner.ImageOverlay";
import { TextBlock } from "@/components/themed/CategoryBanner/CategoryBanner.TextBlock";
import { StripedRule } from "@/components/themed/CategoryBanner/CategoryBanner.StripedRule";

import { StickyPills } from "@/components/themed/CategoryNav/CategoryNav.StickyPills";
import { TabsTop } from "@/components/themed/CategoryNav/CategoryNav.TabsTop";

import { Compact } from "@/components/themed/MenuItemCard/MenuItemCard.Compact";
import { Magazine } from "@/components/themed/MenuItemCard/MenuItemCard.Magazine";

const PAIRING_ID = "modern-sans";
const PANEL_W = 390;
const PANEL_H = 720;

const SAMPLE_GROUPS = [
  { id: 1, name: "Starters" },
  { id: 2, name: "Mains" },
  { id: 3, name: "Desserts" },
  { id: 4, name: "Drinks" },
];

const SAMPLE_GROUPS_RTL = [
  { id: 1, name: "מנות פתיחה" },
  { id: 2, name: "מנות עיקריות" },
  { id: 3, name: "קינוחים" },
  { id: 4, name: "משקאות" },
];

const SAMPLE_ITEMS_LTR: MenuItem[] = [
  {
    id: "1",
    name: "Heirloom Tomato Salad",
    description: "Whipped feta, cucumber, sumac, basil oil, focaccia toast.",
    price: 58,
    groupId: "1",
  },
  {
    id: "2",
    name: "Slow-Roasted Lamb",
    description: "Eggplant cream, charred onion, pomegranate, herb yogurt.",
    price: 124,
    groupId: "2",
  },
];

const SAMPLE_ITEMS_RTL: MenuItem[] = [
  {
    id: "1",
    name: "סלט עגבניות",
    description: "פטה, מלפפון, שמן בזיליקום, פוקצ׳ה.",
    price: 58,
    groupId: "1",
  },
  {
    id: "2",
    name: "כתף טלה בבישול ארוך",
    description: "קרם חציל, בצל חרוך, רימון, יוגורט.",
    price: 124,
    groupId: "2",
  },
];

function HeroFor({ layout, name, address, tagline }: { layout: LayoutConfig; name: string; address?: string; tagline?: string }) {
  const props = { name, address, tagline };
  switch (layout.hero) {
    case "fullbleed":     return <Fullbleed {...props} />;
    case "centered-card": return <CenteredCard {...props} />;
    case "minimal-bar":   return <MinimalBar {...props} />;
  }
}

function BannerFor({ layout, name, description }: { layout: LayoutConfig; name: string; description?: string }) {
  const capitalize = layout.capitalizeBanners;
  const props = { name, description, capitalize };
  switch (layout.banner) {
    case "image-overlay": return <ImageOverlay {...props} />;
    case "text-block":    return <TextBlock {...props} />;
    case "striped-rule":  return <StripedRule {...props} />;
    case "none":          return null;
  }
}

function NavFor({ layout, groups }: { layout: LayoutConfig; groups: { id: number | string; name: string }[] }) {
  const navProps = { groups, activeGroupId: groups[0]?.id ?? null, onSelect: () => {} };
  switch (layout.navStyle) {
    case "sticky-pills-top":    return <StickyPills {...navProps} position="top" />;
    case "sticky-pills-bottom": return <StickyPills {...navProps} position="bottom" />;
    case "tabs-top":            return <TabsTop {...navProps} />;
  }
}

function Panel({ theme, pairing, dir }: { theme: Theme; pairing: TypographyPairing; dir: "ltr" | "rtl" }) {
  const groups = dir === "rtl" ? SAMPLE_GROUPS_RTL : SAMPLE_GROUPS;
  const items = dir === "rtl" ? SAMPLE_ITEMS_RTL : SAMPLE_ITEMS_LTR;
  const restaurantName = dir === "rtl" ? "מסעדת אבנר" : "Avner’s Kitchen";
  const address = dir === "rtl" ? "רוטשילד 12, תל אביב" : "12 Rothschild Blvd, Tel Aviv";
  const tagline = dir === "rtl" ? "מנות עונתיות, חומרי גלם מקומיים." : "Seasonal plates, local sourcing.";
  const sectionName = dir === "rtl" ? "מנות עיקריות" : "Mains";

  const displayFamily = dir === "rtl" ? pairing.pairing.displayHebrew.family : pairing.pairing.displayLatin.family;
  const bodyFamily    = dir === "rtl" ? pairing.pairing.bodyHebrew.family    : pairing.pairing.bodyLatin.family;

  const fontStyle: React.CSSProperties = {
    ["--font-display" as string]: `"${displayFamily}", system-ui, sans-serif`,
    ["--font-body" as string]: `"${bodyFamily}", system-ui, sans-serif`,
    width: PANEL_W,
    height: PANEL_H,
    background: "var(--bg)",
    overflow: "hidden",
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-mono text-zinc-400 px-1">
        {theme.id} · {dir}
      </div>
      <div
        data-theme={theme.id}
        dir={dir}
        data-testid={`panel-${theme.id}-${dir}`}
        className="rounded-md ring-1 ring-zinc-700/40 overflow-hidden"
        style={fontStyle}
      >
        <div className="h-full overflow-y-auto">
          <HeroFor layout={theme.layout} name={restaurantName} address={address} tagline={tagline} />
          <NavFor layout={theme.layout} groups={groups} />
          <BannerFor layout={theme.layout} name={sectionName} description={dir === "rtl" ? "מנות חמות" : "Hot from the kitchen"} />
          <div className="px-3 pb-6 flex flex-col gap-2">
            {items.map((item) => {
              const Variant = theme.layout.itemDensityDefault === "magazine" ? Magazine : Compact;
              return (
                <Variant
                  key={item.id}
                  item={item}
                  currencySymbol="₪"
                  density={theme.layout.itemDensityDefault}
                  isMostPopular={item.id === "1"}
                  onClick={() => {}}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SandboxGridPage() {
  const pairing = pairingsById[PAIRING_ID];
  if (!pairing) {
    return <div className="p-6 text-red-500">Missing pairing: {PAIRING_ID}</div>;
  }

  return (
    <main className="min-h-screen bg-zinc-900 text-zinc-100 p-6">
      <header className="mb-6">
        <h1 className="text-lg font-semibold">Visual regression grid</h1>
        <p className="text-sm text-zinc-400">
          {themes.length} themes × LTR/RTL · pairing {pairing.name} · used by tests/visual/grid.spec.ts
        </p>
      </header>
      <div className="grid grid-cols-2 gap-x-6 gap-y-8">
        {themes.flatMap((theme) =>
          (["ltr", "rtl"] as const).map((dir) => (
            <Panel key={`${theme.id}-${dir}`} theme={theme} pairing={pairing} dir={dir} />
          )),
        )}
      </div>
    </main>
  );
}
