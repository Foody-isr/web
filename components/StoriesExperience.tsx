"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Reel } from "@/services/api";
import { useI18n } from "@/lib/i18n";
import type { Restaurant } from "@/lib/types";

interface StoriesExperienceProps {
  restaurant: Restaurant;
  reels: Reel[];
}

/**
 * Full-screen, vertically-swipeable Stories/Reels feed (TikTok/Instagram style).
 * Each reel fills the viewport; scroll-snap moves to the next. The in-view video
 * autoplays (muted, per mobile autoplay policy) — tap to toggle sound.
 */
export function StoriesExperience({ restaurant, reels }: StoriesExperienceProps) {
  const { t, direction } = useI18n();
  const slug = restaurant.slug || String(restaurant.id);

  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);

  // Autoplay whichever reel is in view; pause the rest.
  useEffect(() => {
    if (reels.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const idx = Number((entry.target as HTMLElement).dataset.index);
          const video = videoRefs.current[idx];
          if (!video) return;
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            setActiveIndex(idx);
            video.play().catch(() => {
              /* autoplay can be blocked until the user interacts — ignore */
            });
          } else {
            video.pause();
          }
        });
      },
      { threshold: [0, 0.6, 1] },
    );
    const slides = document.querySelectorAll("[data-reel-slide]");
    slides.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [reels.length]);

  // Apply the shared mute state to every video element.
  useEffect(() => {
    videoRefs.current.forEach((v) => {
      if (v) v.muted = muted;
    });
  }, [muted, activeIndex]);

  if (reels.length === 0) {
    return (
      <main
        dir={direction}
        className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center"
        style={{ background: "var(--bg-page)", color: "var(--text)", fontFamily: "var(--font-body)" }}
      >
        <div className="text-5xl">🎬</div>
        <h1 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          {t("storiesEmptyTitle") || "No stories yet"}
        </h1>
        <p className="max-w-xs text-sm" style={{ color: "var(--text-muted)" }}>
          {t("storiesEmptyBody") || "This restaurant hasn't shared any reels yet. Check back soon!"}
        </p>
        <Link
          href={`/r/${slug}/order`}
          className="mt-2 rounded-full px-5 py-2 text-sm font-semibold"
          style={{ background: "var(--brand)", color: "var(--ink-on-accent)" }}
        >
          {t("navMenu") || "Menu"}
        </Link>
      </main>
    );
  }

  return (
    <main
      dir={direction}
      className="relative h-[100dvh] w-full overflow-hidden bg-black"
      style={{ fontFamily: "var(--font-body)" }}
    >
      {/* Top gradient (brand-tinted) + back to menu */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 h-24"
        style={{ background: "linear-gradient(to bottom, rgba(var(--brand-rgb), 0.55), transparent)" }}
      />
      <Link
        href={`/r/${slug}/order`}
        className="absolute left-4 top-4 z-30 flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium text-white backdrop-blur"
        style={{ background: "rgba(var(--brand-rgb), 0.38)" }}
      >
        <span className="rtl:rotate-180">←</span>
        <span className="max-w-[45vw] truncate">{restaurant.name}</span>
      </Link>

      {/* Mute toggle */}
      <button
        type="button"
        onClick={() => setMuted((m) => !m)}
        className="absolute right-4 top-4 z-30 flex h-9 w-9 items-center justify-center rounded-full text-white backdrop-blur"
        style={{ background: "rgba(var(--brand-rgb), 0.38)" }}
        aria-label={muted ? t("storiesUnmute") || "Unmute" : t("storiesMute") || "Mute"}
      >
        {muted ? "🔇" : "🔊"}
      </button>

      {/* Persistent order CTA, kept above the device safe-area inset. */}
      <Link
        href={`/r/${slug}/order`}
        className="absolute right-4 z-30 flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-lg"
        style={{
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
          background: "var(--brand)",
          color: "var(--ink-on-accent)",
          fontFamily: "var(--font-body)",
        }}
        aria-label={t("storiesOrderCta") || "Order"}
      >
        <BagIcon />
        {t("storiesOrderCta") || "Order"}
      </Link>

      <div className="h-full w-full snap-y snap-mandatory overflow-y-scroll">
        {reels.map((reel, i) => (
          <section
            key={reel.id}
            data-reel-slide
            data-index={i}
            className="relative flex h-[100dvh] w-full snap-start items-center justify-center overflow-hidden"
          >
            {reel.provider === "instagram" || reel.provider === "manual" ? (
              <video
                ref={(el) => {
                  videoRefs.current[i] = el;
                }}
                src={reel.streamUrl}
                poster={reel.thumbnailUrl || undefined}
                className="h-full w-full object-contain"
                playsInline
                muted={muted}
                loop
                preload={i === 0 ? "auto" : "metadata"}
                onClick={() => setMuted((m) => !m)}
              />
            ) : (
              // TikTok (and other embed-only providers): official embed player.
              <iframe
                src={reel.embedUrl}
                title={reel.caption || "reel"}
                className="h-full w-full"
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
              />
            )}

            {/* Caption overlay — dark near the text for legibility, brand tint
                in the middle, fading to clear. */}
            {reel.caption && (
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-4 pb-24 pt-16"
                style={{
                  background:
                    "linear-gradient(to top, rgba(0,0,0,0.72), rgba(var(--brand-rgb), 0.28) 45%, transparent)",
                }}
              >
                <p className="line-clamp-3 text-sm text-white drop-shadow">{reel.caption}</p>
                {reel.permalink && (
                  <a
                    href={reel.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pointer-events-auto mt-2 inline-block text-xs font-semibold text-white/85 underline"
                  >
                    {t("storiesViewOnInstagram") || "View on Instagram"}
                  </a>
                )}
              </div>
            )}
          </section>
        ))}
      </div>

    </main>
  );
}

function BagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12l-1 13H7L6 7z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7a3 3 0 016 0" />
    </svg>
  );
}
