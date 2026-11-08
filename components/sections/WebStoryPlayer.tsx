"use client";

import { useRef, useState, type RefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import { FramedImage } from "@/components/website-v3/FramedImage";
import { isByWeight, itemDisplayPriceRange } from "@/lib/cart";
import { formatMoney } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import { tField } from "@/lib/translations";
import type { Restaurant } from "@/lib/types";
import { featuredEligibleItems } from "@/lib/websiteFeaturedItems";
import { fetchMenu } from "@/services/api";

const control = "grid h-11 w-11 shrink-0 place-items-center rounded-full bg-black/55 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

function linkedItemId(href: string | null, restaurant: Restaurant) {
  if (!href || href.startsWith("#")) return null;
  const slug = encodeURIComponent(restaurant.slug || String(restaurant.id));
  let link: URL;
  try {
    link = new URL(href, "https://app.foody-pos.co.il");
  } catch {
    return null;
  }
  if (link.protocol !== "https:") return null;

  const isFoody = link.hostname === "app.foody-pos.co.il" || link.hostname === "dev-app.foody-pos.co.il";
  const isCustomDomain = link.hostname === restaurant.customDomain;
  const matchesRestaurant = (isFoody && [`/r/${slug}/order`, `/r/${slug}/menu`].includes(link.pathname))
    || (isCustomDomain && ["/order", "/menu"].includes(link.pathname));
  const id = link.searchParams.get("item");
  return matchesRestaurant && id && /^[1-9]\d*$/.test(id) ? id : null;
}

/** Plays a sequence of portrait stories and shows each story's linked item or page. */
export function WebStoryPlayer({
  reel,
  restaurant,
  player,
  titleId,
  index,
  count,
  playbackError,
  onPlaybackError,
  onNavigate,
  onClose,
}: {
  reel: { id: string; title: string; video: string; poster: string | null; href: string | null; label: string; source: string | null };
  restaurant: Restaurant;
  player: RefObject<HTMLVideoElement | null>;
  titleId: string;
  index: number;
  count: number;
  playbackError: boolean;
  onPlaybackError: () => void;
  onNavigate: (step: -1 | 1) => void;
  onClose: () => void;
}) {
  const { t, direction, locale } = useI18n();
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [muted, setMuted] = useState(false);
  const [playingReel, setPlayingReel] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState({ id: reel.id, progress: 0 });
  const playing = playingReel === reel.id;
  const progress = playhead.id === reel.id ? playhead.progress : 0;
  const PreviousIcon = direction === "rtl" ? ChevronRightIcon : ChevronLeftIcon;
  const NextIcon = direction === "rtl" ? ChevronLeftIcon : ChevronRightIcon;
  const itemId = linkedItemId(reel.href, restaurant);
  const { data: menu } = useQuery({
    queryKey: ["web-story-menu", restaurant.id],
    queryFn: () => fetchMenu(String(restaurant.id)),
    enabled: itemId !== null,
    retry: false,
  });
  const item = menu && itemId ? featuredEligibleItems(menu.menus).find(candidate => candidate.id === itemId) : undefined;
  const itemName = item ? tField(item, "name", locale) : null;
  const price = item && !isByWeight(item) ? itemDisplayPriceRange(item) : null;
  const priceText = price ? formatMoney(price.min, menu?.currency)
    + (price.min < price.max ? ` – ${formatMoney(price.max, menu?.currency)}` : "") : null;

  function togglePlayback() {
    const video = player.current;
    if (!video) return;
    if (video.paused) void video.play().catch(onPlaybackError);
    else video.pause();
  }

  return (
    <div
      className="relative isolate h-full w-full overflow-hidden bg-[#181b16] text-white"
      dir={direction}
      onKeyDown={event => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const forward = direction === "rtl" ? event.key === "ArrowLeft" : event.key === "ArrowRight";
        onNavigate(forward ? 1 : -1);
      }}
    >
      <div
        className="absolute inset-0 touch-pan-y"
        onTouchStart={event => {
          const point = event.touches[0];
          touchStart.current = point ? { x: point.clientX, y: point.clientY } : null;
        }}
        onTouchCancel={() => { touchStart.current = null; }}
        onTouchEnd={event => {
          const start = touchStart.current;
          const end = event.changedTouches[0];
          touchStart.current = null;
          if (!start || !end) return;
          const dx = end.clientX - start.x;
          const dy = end.clientY - start.y;
          if (Math.abs(dx) < 45 || Math.abs(dx) < 1.5 * Math.abs(dy)) return;
          const forward = direction === "rtl" ? dx > 0 : dx < 0;
          onNavigate(forward ? 1 : -1);
        }}
      >
        <video
          ref={player}
          src={reel.video}
          poster={reel.poster ?? undefined}
          aria-label={reel.title}
          muted={muted}
          playsInline
          disablePictureInPicture
          className="h-full w-full object-cover"
          onPlaying={() => setPlayingReel(reel.id)}
          onPause={() => setPlayingReel(null)}
          onError={() => { setPlayingReel(null); onPlaybackError(); }}
          onTimeUpdate={event => {
            const { currentTime, duration } = event.currentTarget;
            if (Number.isFinite(duration) && duration > 0)
              setPlayhead({ id: reel.id, progress: Math.min(1, currentTime / duration) });
          }}
          onEnded={() => {
            setPlayingReel(null);
            setPlayhead({ id: reel.id, progress: 1 });
            onNavigate(1);
          }}
        />
      </div>
      <header className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 to-transparent px-3 pb-10 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div role="progressbar" aria-label={reel.title} aria-valuenow={Math.round(progress * 100)} className="flex gap-1">
          {Array.from({length: count}, (_, position) => (
            <span key={position} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/40">
              <span className="block h-full origin-left rounded-full bg-white rtl:origin-right" style={{ transform: `scaleX(${position < index ? 1 : position === index ? progress : 0})` }} />
            </span>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          {restaurant.logoUrl && (
            <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white">
              <FramedImage src={restaurant.logoUrl} alt="" fill sizes="40px" loading="eager" className="object-contain" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white/90">{restaurant.name}</p>
            <h2 id={titleId} className="truncate text-sm font-semibold !text-white">{reel.title}</h2>
          </div>
          <button type="button" className={`pointer-events-auto ${control}`} aria-label={muted ? t("storiesUnmute") : t("storiesMute")} onClick={() => setMuted(!muted)}>
            {muted ? <SpeakerXMarkIcon className="h-5 w-5" /> : <SpeakerWaveIcon className="h-5 w-5" />}
          </button>
          <button type="button" autoFocus className={`pointer-events-auto ${control}`} aria-label={t("close")} onClick={onClose}>
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      </header>
      <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-between px-3">
        <button type="button" className={`pointer-events-auto ${control} disabled:invisible`} aria-label={t("websiteCampaignPrevious")} disabled={index === 0} onClick={() => onNavigate(-1)}>
          <PreviousIcon className="h-5 w-5" />
        </button>
        {playbackError && <p role="status" className="rounded-lg bg-black/80 px-3 py-2 text-center text-sm">{t("websiteReelUnavailable")}</p>}
        <button type="button" className={`pointer-events-auto ${control} disabled:invisible`} aria-label={t("websiteCampaignNext")} disabled={index === count - 1} onClick={() => onNavigate(1)}>
          <NextIcon className="h-5 w-5" />
        </button>
      </div>
      <footer className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-12">
        <div className="mb-1 flex items-center justify-between gap-2">
          <button
            type="button"
            className={`pointer-events-auto ${control}`}
            aria-label={t(playing ? "websiteStoryPause" : "websiteStoryPlay")}
            onClick={togglePlayback}
          >
            {playing ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
          </button>
          {reel.source && <a className="pointer-events-auto rounded-full bg-black/55 px-3 py-2 text-xs font-semibold text-white underline-offset-4 hover:underline" href={reel.source} target="_blank" rel="noopener noreferrer">{t("storiesViewOnInstagram")}</a>}
        </div>
        {reel.href && reel.label && (
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-[#f8f5ed] p-2 text-[#24332a]">
            {item?.imageUrl && (
              <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-black/5">
                <FramedImage src={item.imageUrl} alt="" fill sizes="64px" loading="eager" className="object-cover" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              {itemName && <p className="mb-1 flex items-start justify-between gap-2 px-1 text-sm font-semibold leading-tight"><span>{itemName}</span>{priceText && <span className="shrink-0">{priceText}</span>}</p>}
              <a href={reel.href} onClick={onClose} className="grid min-h-11 place-items-center rounded-xl bg-[var(--brand)] px-2 py-1 text-center text-sm font-semibold leading-tight text-[var(--ink-on-accent,white)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{reel.label}</a>
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}
