"use client";

import { SectionProps } from "./SectionRenderer";
import { getBodyClass } from "./typography";

/**
 * Horizontal scrolling marquee text section.
 * Content: text (pipe-separated phrases), speed (slow/normal/fast)
 */
export function ScrollingTextSection({ section }: SectionProps) {
  const rawText: string = section.content?.text || "";
  const speed: string = section.content?.speed || "normal";

  const phrases = rawText
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);

  if (phrases.length === 0) return null;

  const durationMap: Record<string, string> = {
    slow: "30s",
    normal: "20s",
    fast: "12s",
  };
  const duration = durationMap[speed] || durationMap.normal;

  // Double the phrases for seamless loop
  const marqueeContent = [...phrases, ...phrases];

  return (
    <section className="overflow-hidden bg-[var(--brand)] text-white py-3">
      <div
        className="flex whitespace-nowrap animate-marquee"
        style={{
          animationDuration: duration,
        }}
      >
        {marqueeContent.map((phrase, i) => (
          <span key={i} className={`mx-8 ${getBodyClass(section.settings)} font-semibold shrink-0`}>
            {phrase}
          </span>
        ))}
      </div>
      <style jsx>{`
        @keyframes marquee {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-marquee {
          animation: marquee linear infinite;
        }
      `}</style>
    </section>
  );
}
