import { Restaurant, WebsiteSection } from "@/lib/types";
import { FooterSection } from "@/components/sections/FooterSection";

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
  const sections = sectionsOverride ?? restaurant.websiteSections ?? [];
  const footer =
    sections.find((s) => s.sectionType === "footer" && s.isVisible && s.page === "_site") ??
    sections.find((s) => s.sectionType === "footer" && s.isVisible);
  if (!footer) return null;
  return <FooterSection section={footer} restaurant={restaurant} />;
}
