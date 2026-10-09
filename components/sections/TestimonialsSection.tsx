"use client";

import { useEffect, useRef, useState } from "react";
import { useWebsiteMotion } from "@/hooks/useWebsiteMotion";
import { useI18n } from "@/lib/i18n";
import { getSectionBg } from "./sectionBg";
import { SectionProps } from "./SectionRenderer";

type Review = {
  name: string;
  text: string;
  rating: number;
};

/**
 * Horizontally scrollable testimonial cards.
 * Content: reviews array [{name, text, rating}]
 */
export function TestimonialsSection({ section }: SectionProps) {
  const reviews: Review[] = section.content?.reviews || [];

  if (reviews.length === 0) return null;
  if (section.layout === "carousel")
    return <ReviewCarousel reviews={reviews} settings={section.settings} />;

  if (
    section.settings.theme_layout ||
    ["grid", "carousel"].includes(section.layout)
  ) {
    const bg = getSectionBg(section.settings, "site");
    const grid = section.layout === "grid";
    return (
      <section
        className={`py-20 md:py-28 px-8 ${bg.className}`}
        style={bg.style}
      >
        <div
          className={`max-w-[1200px] mx-auto ${grid ? "grid md:grid-cols-3 gap-12" : "flex overflow-x-auto gap-12 snap-x snap-mandatory"}`}
        >
          {reviews.map((review, index) => (
            <figure
              key={index}
              className={`${grid ? "" : "w-full shrink-0 snap-center"} text-center space-y-8`}
            >
              <blockquote
                className="max-w-4xl mx-auto text-3xl md:text-4xl leading-snug"
                style={{ fontFamily: "var(--site-heading-font, inherit)" }}
              >
                {review.text}
              </blockquote>
              <figcaption className="text-base">{review.name}</figcaption>
            </figure>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[var(--surface-subtle)] py-16 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
          {reviews.map((review, i) => (
            <div
              key={i}
              className="shrink-0 w-[300px] md:w-[360px] snap-start bg-[var(--surface)] rounded-xl p-6 flex flex-col gap-3"
            >
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, starIdx) => (
                  <span
                    key={starIdx}
                    className={`text-lg ${
                      starIdx < review.rating
                        ? "text-yellow-400"
                        : "text-gray-300"
                    }`}
                  >
                    ★
                  </span>
                ))}
              </div>
              <p className="text-[var(--text)] text-sm leading-relaxed line-clamp-4">
                {review.text}
              </p>
              <p className="text-[var(--text-muted)] text-sm font-semibold mt-auto">
                {review.name}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** One review per slide with explicit pause, hover/focus pause and reduced-motion support. */
function ReviewCarousel({
  reviews,
  settings,
}: {
  reviews: Review[];
  settings: Record<string, unknown>;
}) {
  const { t, locale } = useI18n();
  const allowed = useWebsiteMotion(settings.motion);
  const root = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const autoplay =
    settings.carousel_autoplay === true &&
    (settings.motion as { enabled?: boolean } | undefined)?.enabled !== false;
  const interval =
    typeof settings.carousel_interval === "number"
      ? Math.max(2000, Math.min(15000, settings.carousel_interval))
      : 5000;
  const duration =
    typeof settings.carousel_duration === "number"
      ? Math.max(100, Math.min(2000, settings.carousel_duration))
      : 500;
  const active = index % reviews.length;
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry.isIntersecting),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (
      !allowed ||
      !visible ||
      !autoplay ||
      paused ||
      hovered ||
      focused ||
      reviews.length < 2
    )
      return;
    const timer = window.setTimeout(
      () => setIndex((value) => (value + 1) % reviews.length),
      interval,
    );
    return () => window.clearTimeout(timer);
  }, [
    allowed,
    visible,
    autoplay,
    paused,
    hovered,
    focused,
    reviews.length,
    interval,
    index,
  ]);
  const navigate = (direction: number) => {
    setPaused(true);
    setIndex((active + direction + reviews.length) % reviews.length);
  };
  const bg = getSectionBg(settings, "site");
  return (
    <section
      ref={root}
      className={`py-16 px-6 ${bg.className}`}
      style={bg.style}
      aria-roledescription="carousel"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
    >
      <div
        className="max-w-6xl mx-auto overflow-hidden"
        aria-live={autoplay && !paused ? "off" : "polite"}
      >
        <div
          className="website-testimonial-track flex items-start"
          style={{
            transform: `translateX(${active * (locale === "he" ? 100 : -100)}%)`,
            transition: allowed ? `transform ${duration}ms ease` : "none",
          }}
        >
          {reviews.map((review, i) => (
            <figure
              key={i}
              aria-hidden={i !== active}
              className="w-full shrink-0 text-center space-y-8 px-4"
            >
              <blockquote className="max-w-4xl mx-auto text-xl md:text-2xl leading-relaxed italic">
                {review.text}
              </blockquote>
              <figcaption
                className="text-lg font-semibold"
                style={{ color: "var(--site-link, var(--brand))" }}
              >
                {review.name}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
      {reviews.length > 1 && (
        <div
          className="flex items-center justify-center gap-6 mt-8"
          style={{ color: "var(--site-link, var(--brand))" }}
        >
          <button
            type="button"
            className="p-2 text-2xl"
            aria-label={t("websiteReviewPrevious")}
            onClick={() => navigate(-1)}
          >
            {locale === "he" ? "›" : "‹"}
          </button>
          <span className="tabular-nums" dir="ltr">
            {active + 1} / {reviews.length}
          </span>
          <button
            type="button"
            className="p-2 text-2xl"
            aria-label={t("websiteReviewNext")}
            onClick={() => navigate(1)}
          >
            {locale === "he" ? "‹" : "›"}
          </button>
          {autoplay && (
            <button
              type="button"
              className="p-2 text-sm"
              onClick={() => setPaused((value) => !value)}
              aria-label={t(
                paused ? "websiteCarouselPlay" : "websiteCarouselPause",
              )}
            >
              {paused ? "▶" : "Ⅱ"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
