"use client";

import { useResolvedTheme } from "@/lib/themes/useResolvedTheme";
import { sectionSiteColorId } from "@/lib/siteColors";
import { WebsiteSection, Restaurant } from "@/lib/types";
import { SquareContentSection } from "./SquareContentSection";
import { HeroBannerSection } from "./HeroBannerSection";
import { AnimatedTextSection } from "./AnimatedTextSection";
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
  text: SquareContentSection,
  button: SquareContentSection,
  video: SquareContentSection,
  embed: SquareContentSection,
  pdf: SquareContentSection,
  location_hours: SquareContentSection,
  forms: SquareContentSection,
  newsletter: SquareContentSection,
  rss_feed: SquareContentSection,
  featured_categories: SquareContentSection,
  donation: SquareContentSection,
  events: SquareContentSection,
  featured_menu: MenuHighlightsSection,
  hero_banner: HeroBannerSection,
  scrolling_text: ScrollingTextSection,
  animated_text: AnimatedTextSection,
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
  const { config } = useResolvedTheme();
  const { locale, t } = useI18n();
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
      {visibleSections.map((original, index) => {
        const colorStyle = sectionSiteColorId(config?.customPalette, original.settings?.color_style);
        const section: WebsiteSection = {
          ...original,
          settings: { ...original.settings, color_style: colorStyle },
        };
        const Component = SECTION_COMPONENTS[section.sectionType];
        if (!Component) return null;
        const isFirst = index === 0;
        const isLegacyHighlighted = highlightedSectionId === section.id;

        const inner = (
          <div
            id={typeof section.settings?.anchor === "string" ? section.settings.anchor : `section-${section.id}`}
            data-website-section
            data-color-style={section.settings?.color_style}
            data-section-type={section.sectionType}
            data-editor-label={section.sectionType === "animated_text" ? t("websiteAnimatedText") : section.sectionType === "scrolling_text" ? t("websiteScrollingText") : section.sectionType === "menu_highlights" ? t("websiteFeaturedItems") : section.sectionType === "featured_menu" ? t("websiteFeaturedMenu") : section.sectionType.replace(/_/g, " ")}
            data-editor-region={section.sectionType === "footer" ? "footer" : undefined}
            data-theme-layout={typeof section.settings?.theme_layout === "string" ? section.settings.theme_layout : undefined}
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
