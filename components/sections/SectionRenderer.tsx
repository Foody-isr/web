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
import { FeatureCardsSection } from "./FeatureCardsSection";
import { PicnicBasketSection } from "./PicnicBasketSection";
import { FooterSection } from "./FooterSection";
import { ComponentType, useEffect, useState } from "react";
import { PreviewSectionWrapper } from "@/components/PreviewSectionWrapper";
import { usePreviewMode } from "@/lib/preview-mode";
import { localizeSection } from "@/lib/sectionLocale";
import { useI18n } from "@/lib/i18n";
import { websiteV3SectionFieldHooks } from "@/lib/websiteV3FieldHooks";
import { visibleSectionsInRenderOrder } from "@/lib/websiteV3Rendering";

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
  feature_cards: FeatureCardsSection,
  picnic_basket: PicnicBasketSection,
  footer: FooterSection,
};

type SectionRendererProps = {
  sections: WebsiteSection[];
  restaurant: Restaurant;
};

export function SectionRenderer({ sections, restaurant }: SectionRendererProps) {
  const previewActive = usePreviewMode();
  const { locale } = useI18n();
  const [highlightedSectionId, setHighlightedSectionId] = useState<number | null>(null);

  // Legacy: keep listening for foody-highlight-section so the old editor still works.
  // The new editor uses an overlay drawn on the parent side; that path doesn't need
  // anything from us beyond the bounds we publish via PreviewSectionWrapper.
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === "foody-highlight-section") {
        setHighlightedSectionId(e.data.sectionId ?? null);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const visibleSections = visibleSectionsInRenderOrder(sections);

  return (
    <>
      {visibleSections.map((section, index) => {
        const Component = SECTION_COMPONENTS[section.sectionType];
        if (!Component) return null;
        const isFirst = index === 0;
        const isLegacyHighlighted = highlightedSectionId === section.id;

        const inner = (
          <div
            data-website-section
            data-section-type={section.sectionType}
            {...websiteV3SectionFieldHooks(section)}
            className="relative"
            style={{
              ...(isFirst ? { paddingTop: "var(--logo-offset, 0px)" } : {}),
            }}
          >
            <Component section={localizeSection(section, locale)} restaurant={restaurant} />
            {isLegacyHighlighted && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  border: "3px solid #8B5CF6",
                  pointerEvents: "none",
                  zIndex: 9999,
                }}
              />
            )}
          </div>
        );

        return (
          <PreviewSectionWrapper key={section.id} id={section.id} active={previewActive}>
            {inner}
          </PreviewSectionWrapper>
        );
      })}
    </>
  );
}
