"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, PauseIcon, PlayIcon } from "@heroicons/react/24/solid";
import { FramedImage } from "@/components/website-v3/FramedImage";
import { campaignCanPlay, campaignHeroDesign, campaignSlideIndex, campaignSlides } from "@/lib/campaignHero";
import { imageFrameRect, type ImageFraming } from "@/lib/imageFraming";
import { resolveRestaurantWebsiteHref } from "@/lib/restaurantWebsiteLink";
import { useI18n } from "@/lib/i18n";
import type { SectionProps } from "./SectionRenderer";
import { ensureFont, getFieldStyle } from "./typography";
import { getSectionBg } from "./sectionBg";

/** A keyboard- and touch-operated media campaign using the existing hero content contract. */
export function CampaignHero({ section, restaurant }: SectionProps) {
  const settings = section.settings || {};
  const slides = campaignSlides(section.content || {});
  const design = campaignHeroDesign(settings);
  const showMedia = settings.show_image_url !== false;
  const { t, direction } = useI18n();
  const bg = getSectionBg(settings, "site");
  const host = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(design.autoplay);
  const [explicitPlay, setExplicitPlay] = useState(false);
  const [environment, setEnvironment] = useState({ reducedMotion: true, editing: true, visible: false, documentVisible: false });
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const canPlay = campaignCanPlay({ playing, explicitPlay, ...environment, hovered, focused, dragging });
  const playbackRequested = playing && (!environment.reducedMotion || explicitPlay);
  const motionControl = slides.length > 1 || showMedia && slides.some(slide => slide.videoUrl);

  useEffect(() => {
    [settings.headline_font, settings.subheadline_font, settings.cta_font].forEach(font => ensureFont(typeof font === "string" ? font : undefined));
  }, [settings.headline_font, settings.subheadline_font, settings.cta_font]);
  useEffect(() => { setPlaying(design.autoplay); setExplicitPlay(false); }, [design.autoplay]);
  useEffect(() => {
    setActive(value => Math.min(value, slides.length - 1));
  }, [slides.length]);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setEnvironment(value => ({
      ...value, reducedMotion: preference.matches,
      editing: document.documentElement.dataset.websiteEditor === "edit",
      documentVisible: !document.hidden,
    }));
    const intersection = new IntersectionObserver(entries => {
      setEnvironment(value => ({ ...value, visible: entries[0]?.isIntersecting === true }));
    }, { threshold: 0.1 });
    const mutation = new MutationObserver(update);
    if (host.current) intersection.observe(host.current);
    mutation.observe(document.documentElement, { attributes: true, attributeFilter: ["data-website-editor"] });
    preference.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    const release = () => setDragging(false);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    update();
    return () => {
      intersection.disconnect(); mutation.disconnect();
      preference.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, []);

  const navigate = (index: number) => {
    const root = viewport.current;
    const target = root?.children[index] as HTMLElement | undefined;
    const first = root?.children[0] as HTMLElement | undefined;
    if (!root || !target || !first) return;
    root.scrollTo({ left: target.offsetLeft - first.offsetLeft, behavior: environment.reducedMotion || environment.editing ? "instant" : "smooth" });
    setActive(index);
  };
  useEffect(() => {
    if (!canPlay || slides.length < 2) return;
    const timer = window.setTimeout(() => {
      const root = viewport.current;
      const next = campaignSlideIndex(active, 1, slides.length);
      const target = root?.children[next] as HTMLElement | undefined;
      const first = root?.children[0] as HTMLElement | undefined;
      if (root && target && first) {
        root.scrollTo({ left: target.offsetLeft - first.offsetLeft, behavior: environment.reducedMotion ? "instant" : "smooth" });
        setActive(next);
      }
    }, design.interval);
    return () => window.clearTimeout(timer);
  }, [active, canPlay, design.interval, environment.reducedMotion, slides.length]);

  return (
    <section ref={host} className={`website-campaign ${bg.className}`} style={bg.style}
      data-height={design.height} data-playing={canPlay} role="region" aria-roledescription={t("websiteCampaignCarousel")}
      aria-label={t("websiteCampaignLabel")}
      onPointerEnter={event => { if (event.pointerType === "mouse") setHovered(true); }}
      onPointerMove={event => { if (event.pointerType === "mouse") setHovered(true); }}
      onPointerDownCapture={event => { if (event.pointerType === "mouse") setHovered(true); }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
      {bg.media}
      <div ref={viewport} className="website-campaign-viewport" dir="ltr" tabIndex={0}
        aria-label={t("websiteCampaignPanels")}
        onPointerDown={() => setDragging(true)}
        onKeyDown={event => {
          if (event.target !== event.currentTarget) return;
          if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            navigate(event.key === "Home" ? 0 : event.key === "End" ? slides.length - 1 : campaignSlideIndex(active, event.key === "ArrowRight" ? 1 : -1, slides.length));
          }
        }}
        onScroll={() => {
          const root = viewport.current;
          if (!root) return;
          const edge = root.getBoundingClientRect().left;
          const distance = Array.from(root.children).map(child => Math.abs(child.getBoundingClientRect().left - edge - parseFloat(getComputedStyle(root).paddingLeft)));
          setActive(distance.indexOf(Math.min(...distance)));
        }}>
        {slides.map((slide, index) => {
          const href = slide.ctaLink ? resolveRestaurantWebsiteHref(slide.ctaLink, restaurant.slug || String(restaurant.id)) : null;
          const authored = Array.isArray(section.content.slides) && section.content.slides.length > 0;
          const editableSlides = authored && section.content.slides.length <= 6 && section.content.slides.every((value: unknown) => value && typeof value === "object" && !Array.isArray(value));
          const field = (name: string) => authored ? editableSlides ? `slides.${index}.${name}` : undefined : name;
          return (
            <article key={slide.id} className="website-campaign-panel" dir={direction}
              role="group" aria-roledescription={t("websiteCampaignSlide")} aria-label={`${index + 1} / ${slides.length}`}
              aria-hidden={index !== active} inert={index !== active ? true : undefined}
              data-align={settings.text_align || settings.text_alignment || "left"}
              data-vertical-align={settings.vertical_align || "center"}
              style={{ backgroundColor: slide.backgroundColor }}>
              <div className="website-campaign-media" data-motion-part="media">
                {showMedia && slide.videoUrl ? (
                  <CampaignVideo src={slide.videoUrl} poster={slide.imageUrl || undefined} framing={slide.videoFraming}
                    imageFit={design.imageFit} playing={canPlay && index === active} />
                ) : showMedia && slide.imageUrl ? (
                  <FramedImage data-editor-field={field("image_url")} src={slide.imageUrl} alt={slide.imageAlt}
                    framing={slide.imageFraming} fill sizes="(max-width: 767px) 90vw, 94vw" priority={index === 0}
                    style={{ objectFit: design.imageFit }} />
                ) : null}
              </div>
              {settings.bg_overlay === true && <div className="website-campaign-overlay" />}
              <div className="website-campaign-copy" data-motion-part="text">
                {slide.headline && settings.show_headline !== false && <h1 data-editor-field={field("headline")} style={getFieldStyle(settings, "headline")}>{slide.headline}</h1>}
                {slide.subheadline && settings.show_subheadline !== false && <p data-editor-field={field("subheadline")} style={getFieldStyle(settings, "subheadline")}>{slide.subheadline}</p>}
                {slide.ctaText && href && settings.show_cta_text !== false && <Link data-editor-field={field("cta_text")}
                  href={href} className="website-campaign-cta"
                  style={{ ...getFieldStyle(settings, "cta"), ...(settings.cta_bg_color ? { backgroundColor: settings.cta_bg_color } : {}) }}>{slide.ctaText}</Link>}
              </div>
            </article>
          );
        })}
      </div>
      {(slides.length > 1 || motionControl) && <div className="website-campaign-controls" dir="ltr">
        {slides.length > 1 && <>
          <button type="button" data-campaign-navigation onClick={() => navigate(campaignSlideIndex(active, -1, slides.length))} aria-label={t("websiteCampaignPrevious")}><ChevronLeftIcon width={20} height={20} /></button>
          <span aria-live={canPlay ? "off" : "polite"} aria-atomic="true">{active + 1} / {slides.length}</span>
          <button type="button" data-campaign-navigation onClick={() => navigate(campaignSlideIndex(active, 1, slides.length))} aria-label={t("websiteCampaignNext")}><ChevronRightIcon width={20} height={20} /></button>
        </>}
        {motionControl && <button type="button" className="website-campaign-play" aria-pressed={playbackRequested}
          disabled={environment.editing}
          aria-label={t(playbackRequested ? "websiteCarouselPause" : "websiteCarouselPlay")}
          onClick={() => {
            const play = !playbackRequested;
            setPlaying(play); setExplicitPlay(play);
            // Deliberate Play releases only the current button focus/stationary
            // pointer. The next focus or pointer interaction restores the guard.
            if (play) { setFocused(false); setHovered(false); }
          }}>
          {playbackRequested ? <PauseIcon width={18} height={18} /> : <PlayIcon width={18} height={18} />}
          <span>{t(playbackRequested ? "websiteCarouselPause" : "websiteCarouselPlay")}</span>
        </button>}
      </div>}
    </section>
  );
}

function CampaignVideo({ src, poster, framing, imageFit, playing }: {
  src: string; poster?: string; framing?: ImageFraming; imageFit: "contain" | "cover"; playing: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(preference.matches);
    const observer = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect;
      if (rect) setSize({ width: rect.width, height: rect.height });
    });
    if (host.current) observer.observe(host.current);
    preference.addEventListener("change", update); update();
    return () => { observer.disconnect(); preference.removeEventListener("change", update); };
  }, []);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (!playing) element.pause();
    else void element.play().catch(() => { element.dataset.playback = "blocked"; });
    return () => element.pause();
  }, [playing, src]);
  const frame = framing && (mobile ? framing.mobile || framing.desktop : framing.desktop);
  const rect = frame ? imageFrameRect(size.width, size.height, natural.width, natural.height, frame) : null;
  const style: CSSProperties = rect?.width ? { position: "absolute", maxWidth: "none", ...rect, objectFit: "fill" }
    : { width: "100%", height: "100%", objectFit: frame?.fit || imageFit };
  return <div ref={host} className="website-campaign-video" data-video-framed={Boolean(frame)}>
    <video ref={video} src={src} poster={poster} muted loop playsInline preload="metadata" aria-hidden="true" style={style}
      onLoadedMetadata={event => setNatural({ width: event.currentTarget.videoWidth, height: event.currentTarget.videoHeight })} />
  </div>;
}
