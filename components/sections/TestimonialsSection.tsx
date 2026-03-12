"use client";

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
