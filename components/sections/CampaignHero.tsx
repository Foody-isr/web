"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, PauseIcon, PlayIcon } from "@heroicons/react/24/solid";
import { FramedImage } from "@/components/website-v3/FramedImage";
import { campaignCanPlay, campaignCenterDelta, campaignHeroDesign, campaignSlideIndex, campaignSlides } from "@/lib/campaignHero";
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
  const [loop, setLoop] = useState(false);
  const activeRef = useRef(active);
  const settleTimer = useRef<number | undefined>(undefined);
  const calibrationFrame = useRef(0);
  const navigationStarted = useRef(false);
  activeRef.current = active;
  const canPlay = campaignCanPlay({ playing, explicitPlay, ...environment, hovered, focused, dragging });
  const playbackRequested = playing && (!environment.reducedMotion || explicitPlay);
  const motionControl = slides.length > 1 || showMedia && slides.some(slide => slide.videoUrl);
  const frames = slides.map((slide, index) => ({ slide, index, clone: "" }));
  if (loop && slides.length > 1) {
    frames.unshift({ slide: slides[slides.length - 1], index: slides.length - 1, clone: "before" });
    frames.push({ slide: slides[0], index: 0, clone: "after" });
  }

  const centerPanel = useCallback((panel: HTMLElement | null, behavior: ScrollBehavior) => {
    const root = viewport.current;
    if (!root || !panel) return;
    const align = () => root.scrollBy({ left: campaignCenterDelta(root.getBoundingClientRect(), panel.getBoundingClientRect()), behavior });
    if (behavior === "instant") {
      // In particular, WebKit must discard the old RTL snap target while an
      // edge copy is replaced by its real panel or the viewport is resized.
      root.style.scrollSnapType = "none";
      window.cancelAnimationFrame(calibrationFrame.current);
      align();
      calibrationFrame.current = window.requestAnimationFrame(() => { align(); root.style.scrollSnapType = ""; });
    } else align();
  }, []);
  const realPanel = useCallback((index: number) => viewport.current?.querySelector<HTMLElement>(`[data-campaign-slide="${index}"]:not([data-campaign-clone])`) || null, []);
  const navigate = useCallback((index: number, step = 0) => {
    navigationStarted.current = true;
    const boundary = step < 0 && activeRef.current === 0 && index === slides.length - 1 ? "before"
      : step > 0 && activeRef.current === slides.length - 1 && index === 0 ? "after" : "";
    const clone = boundary ? viewport.current?.querySelector<HTMLElement>(`[data-campaign-clone="${boundary}"]`) : null;
    centerPanel(clone || realPanel(index), environment.reducedMotion || environment.editing ? "instant" : "smooth");
  }, [centerPanel, environment.editing, environment.reducedMotion, realPanel, slides.length]);
  const settle = useCallback(() => {
    const root = viewport.current;
    if (!root) return;
    // Adding the leading edge copy can emit a native scroll before its initial
    // anchor is calibrated. That is not a guest decision to select the copy.
    if (!navigationStarted.current) {
      setActive(0);
      centerPanel(realPanel(0), "instant");
      return;
    }
    const panels = Array.from(root.querySelectorAll<HTMLElement>("[data-campaign-slide]"));
    const bounds = root.getBoundingClientRect();
    const nearest = panels.reduce<HTMLElement | null>((best, panel) =>
      !best || Math.abs(campaignCenterDelta(bounds, panel.getBoundingClientRect())) < Math.abs(campaignCenterDelta(bounds, best.getBoundingClientRect())) ? panel : best, null);
    if (!nearest) return;
    const index = Number(nearest.dataset.campaignSlide);
    setActive(index);
    if (nearest.dataset.campaignClone) centerPanel(realPanel(index), "instant");
  }, [centerPanel, realPanel]);

  // The server renders the actual first panel. Add inert edge copies only after
  // hydration, and keep the same logical panel centered through every resize.
  useLayoutEffect(() => { setLoop(slides.length > 1); }, [slides.length]);
  useLayoutEffect(() => {
    const root = viewport.current;
    if (!root) return;
    const recenter = () => centerPanel(realPanel(navigationStarted.current ? Math.min(activeRef.current, slides.length - 1) : 0), "instant");
    recenter();
    const observer = new ResizeObserver(recenter);
    observer.observe(root);
    const panel = realPanel(0);
    if (panel) observer.observe(panel);
    return () => { observer.disconnect(); window.cancelAnimationFrame(calibrationFrame.current); root.style.scrollSnapType = ""; window.clearTimeout(settleTimer.current); };
  }, [centerPanel, realPanel, loop, direction, slides.length, design.cardWidth, design.mobileCardWidth, design.gap, design.mobileGap]);

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

  useEffect(() => {
    if (!canPlay || slides.length < 2) return;
    const timer = window.setTimeout(() => {
      const next = campaignSlideIndex(active, 1, slides.length);
      navigate(next, 1);
    }, design.interval);
    return () => window.clearTimeout(timer);
  }, [active, canPlay, design.interval, navigate, slides.length]);

  return (
    <section ref={host} className={`website-campaign ${bg.className}`} style={{ ...bg.style,
      "--campaign-card-width": `${design.cardWidth}%`, "--campaign-card-width-mobile": `${design.mobileCardWidth}%`,
      "--campaign-gap": `${design.gap}px`, "--campaign-gap-mobile": `${design.mobileGap}px`,
    } as CSSProperties}
      data-height={design.height} data-playing={canPlay} role="region" aria-roledescription={t("websiteCampaignCarousel")}
      aria-label={t("websiteCampaignLabel")}
      onPointerEnter={event => { if (event.pointerType === "mouse") setHovered(true); }}
      onPointerMove={event => { if (event.pointerType === "mouse") setHovered(true); }}
      onPointerDownCapture={event => { if (event.pointerType === "mouse") setHovered(true); }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
      {bg.media}
      <div ref={viewport} className="website-campaign-viewport" dir={direction} tabIndex={0}
        aria-label={t("websiteCampaignPanels")}
        onPointerDown={() => { navigationStarted.current = true; setDragging(true); }}
        onWheel={() => { navigationStarted.current = true; }}
        onKeyDown={event => {
          if (event.target !== event.currentTarget) return;
          if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            const step = (event.key === "ArrowRight" ? 1 : -1) * (direction === "rtl" ? -1 : 1);
            navigate(event.key === "Home" ? 0 : event.key === "End" ? slides.length - 1 : campaignSlideIndex(active, step, slides.length), ["Home", "End"].includes(event.key) ? 0 : step);
          }
        }}
        onScroll={() => {
          window.clearTimeout(settleTimer.current);
          settleTimer.current = window.setTimeout(settle, 120);
        }}>
        {frames.map(({ slide, index, clone }) => {
          const href = slide.ctaLink ? resolveRestaurantWebsiteHref(slide.ctaLink, restaurant.slug || String(restaurant.id)) : null;
          const authored = Array.isArray(section.content.slides) && section.content.slides.length > 0;
          const editableSlides = authored && section.content.slides.length <= 6 && section.content.slides.every((value: unknown) => value && typeof value === "object" && !Array.isArray(value));
          const field = (name: string) => clone ? undefined : authored ? editableSlides ? `slides.${index}.${name}` : undefined : name;
          return (
            <article key={`${slide.id}-${clone || "real"}`} className={clone ? "website-campaign-peek" : "website-campaign-panel"} dir={direction}
              data-campaign-slide={index} data-campaign-clone={clone || undefined}
              role="group" aria-roledescription={t("websiteCampaignSlide")} aria-label={`${index + 1} / ${slides.length}`}
              aria-hidden={Boolean(clone) || index !== active}
              data-align={settings.text_align || settings.text_alignment || "left"}
              data-vertical-align={settings.vertical_align || "center"}
              style={{ backgroundColor: slide.backgroundColor }}>
              {/* Keep the outer snap target eligible in WebKit; only its
                  inactive contents are inert and unavailable to keyboard users. */}
              <div className="website-campaign-media" data-motion-part="media" inert={clone || index !== active ? true : undefined}>
                {showMedia && slide.videoUrl ? (
                  <CampaignVideo src={slide.videoUrl} poster={slide.imageUrl || undefined} framing={slide.videoFraming}
                    imageFit={design.imageFit} playing={!clone && canPlay && index === active} />
                ) : showMedia && slide.imageUrl ? (
                  <FramedImage data-editor-field={field("image_url")} src={slide.imageUrl} alt={slide.imageAlt}
                    framing={slide.imageFraming} fill sizes="(max-width: 767px) 90vw, 94vw" priority={!clone && index === 0}
                    style={{ objectFit: design.imageFit }} />
                ) : null}
              </div>
              {settings.bg_overlay === true && <div className="website-campaign-overlay" />}
              <div className="website-campaign-copy" data-motion-part="text" inert={clone || index !== active ? true : undefined}>
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
      {(slides.length > 1 || motionControl && design.showPlaybackControl) && <div className="website-campaign-controls" data-align={design.controlsAlignment} dir="ltr">
        {slides.length > 1 && <>
          <button type="button" data-campaign-navigation="previous" onClick={() => navigate(campaignSlideIndex(active, -1, slides.length), -1)} aria-label={t("websiteCampaignPrevious")}>{direction === "rtl" ? <ChevronRightIcon width={20} height={20} /> : <ChevronLeftIcon width={20} height={20} />}</button>
          {design.showCounter && <span data-campaign-counter aria-live={canPlay ? "off" : "polite"} aria-atomic="true">{active + 1} / {slides.length}</span>}
          <button type="button" data-campaign-navigation="next" onClick={() => navigate(campaignSlideIndex(active, 1, slides.length), 1)} aria-label={t("websiteCampaignNext")}>{direction === "rtl" ? <ChevronLeftIcon width={20} height={20} /> : <ChevronRightIcon width={20} height={20} />}</button>
        </>}
        {motionControl && design.showPlaybackControl && <button type="button" className="website-campaign-play" aria-pressed={playbackRequested}
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
