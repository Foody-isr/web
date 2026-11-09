"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { ChevronLeftIcon, ChevronRightIcon, PlayIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { FramedImage } from "@/components/website-v3/FramedImage";
import { useI18n } from "@/lib/i18n";
import { useIsMobileViewport } from "@/lib/themes/useViewMode";
import { usePreviewMode } from "@/lib/preview-mode";
import { resolveRestaurantWebsiteHref } from "@/lib/restaurantWebsiteLink";
import { websiteContentUrl, websiteMediaUrl } from "@/lib/websiteComponents";
import type { Restaurant } from "@/lib/types";
import { WebStoryPlayer } from "./WebStoryPlayer";

type Reel = {
  id: string;
  title: string;
  video: string;
  poster: string | null;
  label: string;
  href: string | null;
  source: string | null;
};

function validReels(value: unknown, slug: string): Reel[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).flatMap((row, index) => {
    if (!row || typeof row !== "object") return [];
    const video = websiteMediaUrl(row.video_url);
    const title = typeof row.title === "string" ? row.title.trim() : "";
    if (!video || !title) return [];
    const link = websiteContentUrl(row.cta_link);
    const source = websiteMediaUrl(row.source_url);
    return [{
      id: `${row.id || index}-${index}`,
      title,
      video,
      poster: websiteMediaUrl(row.poster_url),
      label: typeof row.cta_text === "string" ? row.cta_text.trim() : "",
      href: link ? resolveRestaurantWebsiteHref(link, slug) : null,
      source: source && /^https:\/\/(www\.)?instagram\.com\//i.test(source) ? source : null,
    }];
  });
}

const arrowClass = "grid h-11 w-11 shrink-0 place-items-center rounded-full border border-current/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

/** Shows portrait video covers and opens one full-viewport player with its own action. */
export function VideoCarouselSection({ content, autoplayPreviews, storyPlayer, sectionId, restaurant, heading, description }: {
  content: unknown;
  autoplayPreviews: boolean;
  storyPlayer: boolean;
  sectionId: number;
  restaurant: Restaurant;
  heading: ReactNode;
  description: ReactNode;
}) {
  const { t, direction } = useI18n();
  const preview = usePreviewMode();
  const isMobile = useIsMobileViewport();
  const slug = restaurant.slug || String(restaurant.id);
  const reels = validReels(content, slug);
  const rail = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const player = useRef<HTMLVideoElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selected = selectedIndex === null ? null : reels[selectedIndex];
  const hasSelection = selectedIndex !== null;
  const [playbackError, setPlaybackError] = useState(false);
  const [activePreview, setActivePreview] = useState<number | null>(null);
  const titleId = `video-carousel-${sectionId}-title`;
  const railId = `video-carousel-${sectionId}-rail`;

  useEffect(() => {
    if (!hasSelection) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => { root.style.overflow = previous; };
  }, [hasSelection]);

  useEffect(() => {
    const cards = Array.from(rail.current?.querySelectorAll("[data-reel-preview-target]") ?? []);
    if (!autoplayPreviews || hasSelection || !cards.length) {
      setActivePreview(null);
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const ratios = new Map<Element, number>();
    function update() {
      if (reducedMotion.matches || document.hidden || document.documentElement.dataset.websiteEditor === "edit") {
        setActivePreview(null);
        return;
      }
      let next: number | null = null;
      let bestRatio = 0.45;
      for (const [index, card] of (isMobile ? cards : cards.slice(0, 1)).entries()) {
        const ratio = ratios.get(card) ?? 0;
        if (ratio >= bestRatio && (next === null || ratio > bestRatio)) {
          next = index;
          bestRatio = ratio;
        }
      }
      setActivePreview(next);
    }
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) ratios.set(entry.target, entry.intersectionRatio);
      update();
    }, { threshold: [0, 0.45, 0.55, 0.65, 0.75, 0.9, 1] });
    for (const card of cards) observer.observe(card);
    reducedMotion.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("foody:website-order-preview", update);
    return () => {
      observer.disconnect();
      reducedMotion.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("foody:website-order-preview", update);
    };
  }, [autoplayPreviews, content, isMobile, hasSelection]);

  function shift(step: number) {
    const element = rail.current;
    const first = element?.firstElementChild;
    const second = first?.nextElementSibling;
    if (!element || !first || !second) return;
    const offset = second.getBoundingClientRect().left - first.getBoundingClientRect().left;
    const end = element.scrollWidth - element.clientWidth;
    const atEdge = step > 0 ? Math.abs(element.scrollLeft) >= end - 2 : Math.abs(element.scrollLeft) <= 2;
    if (atEdge) {
      element.scrollTo({ left: step > 0 ? 0 : Math.sign(offset) * end });
    } else {
      element.scrollBy({ left: offset * step });
    }
  }

  function playSelected() {
    void player.current?.play().catch(() => {
      // An explicit press in the player can start a blocked video.
    });
  }

  function select(index: number) {
    flushSync(() => {
      setSelectedIndex(index);
      setPlaybackError(false);
    });
  }

  function open(event: MouseEvent<HTMLButtonElement>, index: number) {
    const node = dialog.current;
    if (!node || node.open || selected) return;
    opener.current = event.currentTarget;
    select(index);
    node.showModal();
    playSelected();
  }

  function navigate(step: number) {
    if (selectedIndex === null) return;
    const next = selectedIndex + step;
    if (!reels[next]) return;
    select(next);
    playSelected();
  }

  function close() {
    player.current?.pause();
    setSelectedIndex(null);
    opener.current?.focus({ preventScroll: true });
  }

  if (!reels.length) return preview ? <p className="py-8 text-center">{t("websiteMediaEmpty")}</p> : null;
  const PreviousIcon = direction === "rtl" ? ChevronRightIcon : ChevronLeftIcon;
  const NextIcon = direction === "rtl" ? ChevronLeftIcon : ChevronRightIcon;

  return (
    <div className={`grid min-w-0 gap-5 ${storyPlayer ? "" : "md:grid-cols-[minmax(170px,1fr)_minmax(0,2.7fr)] md:items-center md:gap-9"}`} dir={direction}>
      <div className="space-y-3 text-start">
        {heading}
        {description}
        {reels.length > 1 && (
          <div className={`flex gap-2 pt-1 ${reels.length <= 3 ? "md:hidden" : ""}`}>
            <button type="button" className={arrowClass} aria-controls={railId} aria-label={t("websiteCampaignPrevious")} onClick={() => shift(-1)}><PreviousIcon className="h-5 w-5" /></button>
            <button type="button" className={arrowClass} aria-controls={railId} aria-label={t("websiteCampaignNext")} onClick={() => shift(1)}><NextIcon className="h-5 w-5" /></button>
          </div>
        )}
      </div>
      <div
        ref={rail}
        id={railId}
        className={`grid min-w-0 grid-flow-col snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-1 pb-3 pt-1 motion-safe:scroll-smooth md:gap-4 ${storyPlayer ? "auto-cols-[min(65vw,240px)] md:auto-cols-[min(25vw,220px)]" : "auto-cols-[min(68vw,248px)] md:auto-cols-[calc((100%_-_2rem)/3)]"}`}
      >
        {reels.map((reel, index) => (
          <button
            key={reel.id}
            type="button"
            aria-haspopup="dialog"
            onClick={event => open(event, index)}
            className="group grid min-w-0 snap-start content-start gap-2 rounded-xl text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <span data-reel-preview-target className={`relative grid aspect-[9/15] w-full place-items-center overflow-hidden rounded-[16px] bg-black/20 ${storyPlayer ? "" : "md:max-h-[340px]"}`}>
              {reel.poster && <FramedImage src={reel.poster} alt="" fill sizes="(max-width: 767px) 248px, 250px" className="object-cover" />}
              {autoplayPreviews && !selected && activePreview === index && <ReelPreview reel={reel} />}
              <span className="relative grid h-12 w-12 place-items-center rounded-full bg-white text-[#304437] shadow-md motion-safe:transition-transform group-hover:scale-110 peer-data-[playing=true]:invisible" aria-hidden="true">
                <PlayIcon className="h-5 w-5" />
              </span>
              {storyPlayer && <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-3.5 pb-3.5 pt-14 text-sm font-semibold text-white">{reel.title}</span>}
            </span>
            {!storyPlayer && <span className="text-base leading-snug" style={{ fontFamily: "var(--font-display)" }}>{reel.title}</span>}
          </button>
        ))}
      </div>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClose={close}
        onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}
        className={`fixed inset-0 m-auto h-[100dvh] max-h-none w-full max-w-none overflow-hidden border-0 p-0 backdrop:bg-black/80 ${storyPlayer ? "bg-transparent text-white sm:h-[min(92dvh,850px)] sm:w-[min(92vw,51.75dvh,480px)] sm:rounded-2xl" : "bg-[#23251e] text-[#f8f5ed] sm:h-[min(92dvh,920px)] sm:w-[min(94vw,480px)] sm:rounded-2xl"}`}
      >
        {storyPlayer && selected && selectedIndex !== null && (
          <WebStoryPlayer
            reel={selected}
            restaurant={restaurant}
            player={player}
            titleId={titleId}
            index={selectedIndex}
            count={reels.length}
            playbackError={playbackError}
            onPlaybackError={() => setPlaybackError(true)}
            onNavigate={navigate}
            onClose={() => dialog.current?.close()}
          />
        )}
        {!storyPlayer && selected && (
          <div className="grid h-full grid-rows-[auto_minmax(0,1fr)_auto] pt-[env(safe-area-inset-top)]">
            <div className="flex items-center justify-between gap-3 px-4 py-2">
              <h2 id={titleId} className="text-base leading-tight !text-[#f8f5ed] sm:text-lg">{selected.title}</h2>
              <button type="button" autoFocus className={arrowClass} aria-label={t("close")} onClick={() => dialog.current?.close()}>
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="relative grid min-h-0 place-items-center bg-black">
              <video
                ref={player}
                src={selected.video}
                poster={selected.poster ?? undefined}
                aria-label={selected.title}
                controls
                controlsList="nofullscreen"
                playsInline
                disablePictureInPicture
                onError={() => setPlaybackError(true)}
                className="absolute inset-0 h-full w-full object-contain"
              />
              {playbackError && <p role="status" className="relative mx-4 rounded-lg bg-black/85 px-4 py-3 text-center">{t("websiteReelUnavailable")}</p>}
            </div>
            {(selected.href && selected.label || selected.source) && (
              <div className="bg-[#f5f0e7] px-4 pt-3 text-center text-[#27382d] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                {selected.href && selected.label && (
                  <a href={selected.href} onClick={() => dialog.current?.close()} className="grid min-h-12 place-items-center rounded-xl bg-[var(--brand)] px-4 py-2 font-semibold text-[var(--ink-on-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                    {selected.label}
                  </a>
                )}
                {selected.source && <a className="mt-2 inline-block text-sm text-[#344437] underline underline-offset-4" href={selected.source} target="_blank" rel="noopener noreferrer">{t("storiesViewOnInstagram")}</a>}
              </div>
            )}
          </div>
        )}
      </dialog>
    </div>
  );
}

function ReelPreview({ reel }: { reel: Reel }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.defaultMuted = true;
    video.muted = true;
    void video.play().catch(() => {
      // A blocked preview leaves the poster and the full player button available.
    });
    return () => video.pause();
  }, [reel.video]);

  return (
    <video ref={ref} data-reel-preview data-playing={playing} src={reel.video} muted playsInline aria-hidden="true"
      className={`peer pointer-events-none absolute inset-0 h-full w-full object-cover ${playing ? "" : "opacity-0"}`}
      onPlaying={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
      onError={() => setPlaying(false)}
      onTimeUpdate={event => {
        // Keep automatic motion brief when the cover has no playback controls.
        if (event.currentTarget.currentTime >= 4) event.currentTarget.pause();
      }} />
  );
}
