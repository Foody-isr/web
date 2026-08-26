"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CateringCarouselImage } from "@/lib/cateringGallery";

type Props = {
  images: CateringCarouselImage[];
  galleryLabel: string;
  previousLabel: string;
  nextLabel: string;
  photoCountLabel: (current: number, total: number) => string;
};

export function CateringItemGallery({ images, galleryLabel, previousLabel, nextLabel, photoCountLabel }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const firstImageUrl = images[0]?.url;

  useEffect(() => setActiveIndex(0), [firstImageUrl]);

  const move = useCallback((direction: -1 | 1) => {
    if (images.length < 2) return;
    setActiveIndex((current) => (current + direction + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [move]);

  if (images.length === 0) return null;
  const active = images[Math.min(activeIndex, images.length - 1)];

  return (
    <section className="border-b border-[var(--divider)] bg-[var(--surface-subtle)]" aria-label={galleryLabel}>
      <div
        className="relative aspect-[16/9] overflow-hidden bg-black/5"
        onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }}
        onTouchEnd={(event) => {
          if (touchStartX.current === null) return;
          const distance = (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
          touchStartX.current = null;
          if (Math.abs(distance) >= 45) move(distance > 0 ? -1 : 1);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={active.key} src={active.url} alt={active.alt} className="h-full w-full object-cover" />
        {images.length > 1 && (
          <>
            <button type="button" onClick={() => move(-1)} aria-label={previousLabel} className="absolute start-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-2xl text-white shadow-lg backdrop-blur-sm transition hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">‹</button>
            <button type="button" onClick={() => move(1)} aria-label={nextLabel} className="absolute end-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-2xl text-white shadow-lg backdrop-blur-sm transition hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">›</button>
            <span aria-live="polite" className="absolute bottom-3 end-3 rounded-full bg-black/65 px-2.5 py-1 text-xs font-bold tabular-nums text-white backdrop-blur-sm">
              {photoCountLabel(activeIndex + 1, images.length)}
            </span>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto p-3" role="list" aria-label={galleryLabel}>
          {images.map((image, index) => (
            <button
              key={image.key}
              type="button"
              role="listitem"
              aria-current={index === activeIndex ? "true" : undefined}
              aria-label={photoCountLabel(index + 1, images.length)}
              onClick={() => setActiveIndex(index)}
              className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--catering-accent,var(--brand))] ${index === activeIndex ? "border-[var(--catering-accent,var(--brand))]" : "border-transparent opacity-65 hover:opacity-100"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
