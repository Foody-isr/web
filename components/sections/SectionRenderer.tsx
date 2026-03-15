"use client";

import { WebsiteSection, Restaurant } from "@/lib/types";
import { HeroBannerSection } from "./HeroBannerSection";
import { ScrollingTextSection } from "./ScrollingTextSection";
import { TextAndImageSection } from "./TextAndImageSection";
import { GallerySection } from "./GallerySection";
import { TestimonialsSection } from "./TestimonialsSection";
import { AboutSection } from "./AboutSection";
import { MenuHighlightsSection } from "./MenuHighlightsSection";
import { PromoBannerSection } from "./PromoBannerSection";
import { SocialFeedSection } from "./SocialFeedSection";
import { ActionButtonsSection } from "./ActionButtonsSection";
import { ComponentType } from "react";

export type SectionProps = {
  section: WebsiteSection;
  restaurant: Restaurant;
};

const SECTION_COMPONENTS: Record<string, ComponentType<SectionProps>> = {
  hero_banner: HeroBannerSection,
  scrolling_text: ScrollingTextSection,
  text_and_image: TextAndImageSection,
  gallery: GallerySection,
  testimonials: TestimonialsSection,
  about: AboutSection,
  menu_highlights: MenuHighlightsSection,
  promo_banner: PromoBannerSection,
  social_feed: SocialFeedSection,
  action_buttons: ActionButtonsSection,
};

type SectionRendererProps = {
  sections: WebsiteSection[];
  restaurant: Restaurant;
};

export function SectionRenderer({ sections, restaurant }: SectionRendererProps) {
  const visibleSections = sections
    .filter((s) => s.isVisible)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <>
      {visibleSections.map((section) => {
        const Component = SECTION_COMPONENTS[section.sectionType];
        if (!Component) return null;
        return <Component key={section.id} section={section} restaurant={restaurant} />;
      })}
    </>
  );
}
