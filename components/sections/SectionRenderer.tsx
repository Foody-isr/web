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
import { FooterSection } from "./FooterSection";
import { ComponentType, useEffect, useState, useCallback } from "react";

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
  footer: FooterSection,
};

const HIGHLIGHT_COLOR = "#8B5CF6"; // Purple — visible on both light and dark backgrounds

type SectionRendererProps = {
  sections: WebsiteSection[];
  restaurant: Restaurant;
};

export function SectionRenderer({ sections, restaurant }: SectionRendererProps) {
  const [highlightedSectionId, setHighlightedSectionId] = useState<number | null>(null);
  const [isInsideIframe, setIsInsideIframe] = useState(false);

  // Detect if we're inside an iframe (admin preview)
  useEffect(() => {
    setIsInsideIframe(window.self !== window.top);
  }, []);

  // Listen for section highlight messages from admin iframe parent
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === "foody-highlight-section") {
        setHighlightedSectionId(e.data.sectionId ?? null);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Notify admin parent when a section is clicked inside the iframe
  const handleSectionClick = useCallback((sectionId: number) => {
    if (!isInsideIframe) return;
    window.parent.postMessage({ type: "foody-select-section", sectionId }, "*");
  }, [isInsideIframe]);

  const visibleSections = sections
    .filter((s) => s.isVisible)
    .sort((a, b) => {
      // Footer always renders last
      if (a.sectionType === "footer") return 1;
      if (b.sectionType === "footer") return -1;
      return a.sortOrder - b.sortOrder;
    });

  return (
    <>
      {visibleSections.map((section) => {
        const Component = SECTION_COMPONENTS[section.sectionType];
        if (!Component) return null;
        const isHighlighted = highlightedSectionId === section.id;
        return (
          <div
            key={section.id}
            className="relative"
            onClick={isInsideIframe ? () => handleSectionClick(section.id) : undefined}
            style={{
              ...(isInsideIframe ? { cursor: "pointer" } : {}),
              ...(isHighlighted ? {
                zIndex: 10,
                position: "relative" as const,
              } : {}),
            }}
          >
            <Component section={section} restaurant={restaurant} />
            {isHighlighted && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  border: `3px solid ${HIGHLIGHT_COLOR}`,
                  pointerEvents: "none",
                  zIndex: 9999,
                }}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
