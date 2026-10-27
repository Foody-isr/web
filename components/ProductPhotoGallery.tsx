"use client";

import { useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";

/** Product photos with explicit navigation and horizontal touch or pointer swipes. */
export function ProductPhotoGallery({
  images,
  renderImage,
}: {
  images: string[];
  renderImage: (url: string, index: number) => ReactNode;
}) {
  const { t, direction } = useI18n();
  const [selected, setSelected] = useState(0);
  const gesture = useRef<{ x: number; y: number } | null>(null);
  const active = Math.min(selected, Math.max(0, images.length - 1));
  const multiple = images.length > 1;
  const move = (delta: number) =>
    setSelected((active + delta + images.length) % images.length);
  const count = (index: number) =>
    t("product_photo_count")
      .replace("{current}", String(index + 1))
      .replace("{total}", String(images.length));
  return (
    <div
      role="region"
      aria-label={t("product_photo_gallery")}
      aria-roledescription={multiple ? "carousel" : undefined}
      tabIndex={multiple ? 0 : undefined}
      data-no-drag={multiple ? "" : undefined}
      className="relative h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand)]"
      style={multiple ? { touchAction: "pan-y" } : undefined}
      onKeyDown={(event) => {
        if (!multiple || event.target !== event.currentTarget) return;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          move(
            (event.key === "ArrowRight" ? 1 : -1) *
              (direction === "rtl" ? -1 : 1),
          );
        }
      }}
      onPointerDown={(event) => {
        if (
          !multiple ||
          !event.isPrimary ||
          event.button !== 0 ||
          (event.target as HTMLElement).closest("button")
        )
          return;
        gesture.current = { x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {
        gesture.current = null;
      }}
      onPointerUp={(event) => {
        const start = gesture.current;
        gesture.current = null;
        if (!start) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy))
          move((dx < 0 ? 1 : -1) * (direction === "rtl" ? -1 : 1));
      }}
    >
      {renderImage(images[active] || "/assets/placeholder-item-lg.svg", active)}
      {multiple && (
        <>
          <button
            type="button"
            onClick={() => move(-1)}
            aria-label={t("product_photo_previous")}
            className="absolute start-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-2xl text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            {direction === "rtl" ? "›" : "‹"}
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            aria-label={t("product_photo_next")}
            className="absolute end-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-2xl text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            {direction === "rtl" ? "‹" : "›"}
          </button>
          <div className="absolute inset-x-0 bottom-3 flex justify-center">
            <div
              className="flex max-w-full rounded-full bg-black/60 px-1"
              aria-label={t("product_photo_gallery")}
            >
              {images.map((url, index) => (
                <button
                  key={url}
                  type="button"
                  aria-label={count(index)}
                  aria-current={index === active ? "true" : undefined}
                  onClick={() => setSelected(index)}
                  className="grid h-9 w-7 place-items-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                >
                  <span
                    className={`h-2 w-2 rounded-full ${index === active ? "bg-white" : "bg-white/40"}`}
                  />
                </button>
              ))}
            </div>
          </div>
          <span className="sr-only" role="status" aria-live="polite">
            {count(active)}
          </span>
        </>
      )}
    </div>
  );
}
