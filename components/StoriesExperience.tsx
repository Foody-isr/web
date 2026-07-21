"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Reel } from "@/services/api";
import { useI18n } from "@/lib/i18n";
import { BottomNav } from "@/components/BottomNav";

interface StoriesExperienceProps {
  restaurant: { id: number; slug: string; name: string };
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
        style={{ background: "var(--bg-page, #000)", color: "var(--text, #fff)" }}
      >
        <div className="text-5xl">🎬</div>
        <h1 className="text-lg font-semibold">{t("storiesEmptyTitle") || "No stories yet"}</h1>
        <p className="max-w-xs text-sm opacity-70">
          {t("storiesEmptyBody") || "This restaurant hasn't shared any reels yet. Check back soon!"}
        </p>
        <Link
          href={`/r/${slug}/order`}
          className="mt-2 rounded-full px-5 py-2 text-sm font-semibold text-white"
          style={{ background: "var(--brand)" }}
        >
          {t("navMenu") || "Menu"}
        </Link>
        <BottomNav slug={slug} active="stories" />
      </main>
    );
  }

  return (
    <main dir={direction} className="relative h-[100dvh] w-full overflow-hidden bg-black">
      {/* Top gradient + back to menu */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-24 bg-gradient-to-b from-black/60 to-transparent" />
      <Link
        href={`/r/${slug}/order`}
        className="absolute left-4 top-4 z-30 flex h-9 items-center gap-2 rounded-full bg-black/40 px-3 text-sm font-medium text-white backdrop-blur"
      >
        <span className="rtl:rotate-180">←</span>
        <span className="max-w-[45vw] truncate">{restaurant.name}</span>
      </Link>

      {/* Mute toggle */}
      <button
        type="button"
        onClick={() => setMuted((m) => !m)}
        className="absolute right-4 top-4 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur"
        aria-label={muted ? t("storiesUnmute") || "Unmute" : t("storiesMute") || "Mute"}
      >
        {muted ? "🔇" : "🔊"}
      </button>

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

            {/* Caption overlay — lifted above the bottom nav. */}
            {reel.caption && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 to-transparent px-4 pb-24 pt-16">
                <p className="line-clamp-3 text-sm text-white drop-shadow">{reel.caption}</p>
                {reel.permalink && (
                  <a
                    href={reel.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pointer-events-auto mt-2 inline-block text-xs font-semibold text-white/80 underline"
                  >
                    {t("storiesViewOnInstagram") || "View on Instagram"}
                  </a>
                )}
              </div>
            )}
          </section>
        ))}
      </div>

      <BottomNav slug={slug} active="stories" />
    </main>
  );
}
