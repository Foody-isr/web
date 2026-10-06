"use client";

import { SectionProps } from "./SectionRenderer";
import { getBodyClass, getFieldStyle } from "./typography";
import { getSectionBg } from "./sectionBg";

/**
 * Horizontal scrolling marquee text section.
 * Content: text (pipe-separated phrases), speed (slow/normal/fast)
 */
export function ScrollingTextSection({ section }: SectionProps) {
  const rawText: string = section.content?.text || "";
  const speed: string = section.content?.speed || "normal";
  const bg = getSectionBg(section.settings, "brand");

  if (!rawText.trim() || section.settings.show_text === false) return null;

  const durationMap: Record<string, string> = {
    slow: "30s",
    normal: "20s",
    fast: "12s",
  };
  const duration = durationMap[speed] || durationMap.normal;

  return (
    <section className={`overflow-hidden py-3 ${bg.className}`} style={bg.style}>
      <div
        className="flex whitespace-nowrap animate-marquee"
        style={{
          animationDuration: duration,
        }}
      >
        {[0, 1].map((i) => (
          <span key={i} data-editor-field={i === 0 ? "text" : undefined} aria-hidden={i === 1 ? true : undefined} className={`mx-8 ${getBodyClass(section.settings)} font-semibold shrink-0`} style={getFieldStyle(section.settings, "text")}>
            {rawText}
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
