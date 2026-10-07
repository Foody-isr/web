"use client";

import { useResolvedTheme } from "@/lib/themes/useResolvedTheme";
import { sectionSiteColorId } from "@/lib/siteColors";
import { Restaurant, WebsiteSection } from "@/lib/types";
import { FooterSection } from "@/components/sections/FooterSection";
import { localizeSection } from "@/lib/sectionLocale";
import { useI18n } from "@/lib/i18n";

/**
 * Site-wide footer. The footer is a single, shared element that renders at the
 * bottom of every customer page (order, custom pages, landing) — independent of
 * the landing toggle. It's stored as a WebsiteSection of type "footer"; the
 * canonical one carries page "_site". We fall back to any visible footer so
 * pre-migration data (footers on home/menu) still renders.
 *
 * Footer rendering is centralized here and excluded from the per-page
 * SectionRenderer so it never double-renders on the landing page.
 */
export function SiteFooter({
  restaurant,
  sectionsOverride,
}: {
  restaurant: Restaurant;
  sectionsOverride?: WebsiteSection[];
}) {
  const { locale } = useI18n();
  const { config } = useResolvedTheme();
  const sections = sectionsOverride ?? restaurant.websiteSections ?? [];
  const footer =
    sections.find((s) => s.sectionType === "footer" && s.isVisible && s.settings?.theme_retired !== true && s.page === "_site") ??
    sections.find((s) => s.sectionType === "footer" && s.isVisible && s.settings?.theme_retired !== true);
  if (!footer) return null;
  const rendered = {...footer, settings: {...footer.settings, color_style: sectionSiteColorId(config?.customPalette, footer.settings?.color_style)}};
  return <div className="relative" data-color-style={rendered.settings?.color_style} data-editor-region="footer" data-editor-label="Footer"><FooterSection section={localizeSection(rendered, locale)} restaurant={restaurant} /></div>;
}
