import { normalizeImageFraming, type ImageFraming } from "./imageFraming";
import { websiteContentUrl, websiteMediaUrl } from "./websiteComponents";

export type CampaignSlide = {
  id: string;
  imageUrl: string | null;
  videoUrl: string | null;
  imageAlt: string;
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaLink: string | null;
  backgroundColor?: string;
  imageFraming?: ImageFraming;
  videoFraming?: ImageFraming;
};

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const text = (value: unknown) => typeof value === "string" ? value : "";

/** Normalizes authored campaign panels, preserving a historical single hero as fallback. */
export function campaignSlides(content: Record<string, unknown>): CampaignSlide[] {
  const authored = Array.isArray(content.slides)
    ? content.slides.filter(value => value && typeof value === "object" && !Array.isArray(value)).slice(0, 6)
    : [];
  return (authored.length ? authored : [content]).map((value, index) => {
    const slide = record(value);
    const background = text(slide.background_color);
    return {
      id: `${text(slide.id) || "slide"}-${index}`,
      imageUrl: websiteMediaUrl(slide.image_url),
      videoUrl: websiteMediaUrl(slide.video_url),
      imageAlt: text(slide.image_alt),
      headline: text(slide.headline),
      subheadline: text(slide.subheadline),
      ctaText: text(slide.cta_text),
      ctaLink: websiteContentUrl(slide.cta_link),
      backgroundColor: /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(background) ? background : undefined,
      imageFraming: normalizeImageFraming(slide.image_framing),
      videoFraming: normalizeImageFraming(slide.video_framing),
    };
  });
}

/** Bounds campaign playback settings independently of the saved template. */
export function campaignHeroDesign(settings: Record<string, unknown>) {
  const duration = settings.slide_duration_seconds;
  return {
    autoplay: settings.autoplay === true,
    interval: (typeof duration === "number" && Number.isFinite(duration)
      ? Math.min(30, Math.max(5, duration)) : 10) * 1000,
    imageFit: settings.image_fit === "contain" ? "contain" as const : "cover" as const,
    height: ["compact", "medium", "tall", "fullscreen"].includes(String(settings.height))
      ? String(settings.height) : "auto",
  };
}

/** Requires visibility and deliberate motion consent before automatic panels or videos advance. */
export function campaignCanPlay(state: {
  playing: boolean; explicitPlay: boolean; reducedMotion: boolean;
  editing: boolean; hovered: boolean; focused: boolean; dragging: boolean;
  visible: boolean; documentVisible: boolean;
}): boolean {
  return state.playing && (!state.reducedMotion || state.explicitPlay) &&
    !state.editing && !state.hovered && !state.focused && !state.dragging &&
    state.visible && state.documentVisible;
}

/** Wraps campaign controls through their finite ordered panel list. */
export function campaignSlideIndex(index: number, direction: number, count: number): number {
  return count > 0 ? ((index + direction) % count + count) % count : 0;
}
