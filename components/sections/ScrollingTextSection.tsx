"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { SectionProps } from "./SectionRenderer";
import { getFieldStyle, ensureFont } from "./typography";
import { getSectionBg } from "./sectionBg";
import { scrollingTextTypography } from "@/lib/editorialSections";

/** Seamless marquee with the same editable display typography on every theme. */
export function ScrollingTextSection({ section }: SectionProps) {
  const rawText =
    typeof section.content?.text === "string" ? section.content.text : "";
  const settings = section.settings || {};
  const phrase = useRef<HTMLSpanElement>(null);
  const viewport = useRef<HTMLElement>(null);
  const [copies, setCopies] = useState(2);
  useEffect(() => {
    ensureFont(settings.text_font);
    const update = () => {
      const width = phrase.current?.getBoundingClientRect().width || 1;
      setCopies(
        Math.min(
          100,
          Math.max(
            2,
            Math.ceil((viewport.current?.clientWidth || 0) / width) + 1,
          ),
        ),
      );
    };
    const observer = new ResizeObserver(update);
    if (viewport.current) observer.observe(viewport.current);
    if (phrase.current) observer.observe(phrase.current);
    update();
    return () => observer.disconnect();
  }, [rawText, settings.text_font, settings.text_size, settings.show_text]);
  if (!rawText.trim() || settings.show_text === false) return null;
  const bg = getSectionBg(settings, "brand");
  const duration =
    ({ slow: "30s", normal: "20s", fast: "12s" } as Record<string, string>)[
      section.content.speed
    ] || "20s";
  const style = {
    ...getFieldStyle(settings, "text"),
    ...scrollingTextTypography(settings),
    lineHeight: 1.1,
    color: settings.text_color || "var(--site-title, inherit)",
  };
  return (
    <section
      ref={viewport}
      className={`website-marquee ${bg.className}`}
      data-spacing={settings.padding || "compact"}
      style={bg.style}
      tabIndex={0}
      aria-label={rawText}
    >
      <div
        className="website-marquee-track"
        dir="ltr"
        style={
          {
            "--marquee-duration": duration,
            animationDirection:
              settings.direction === "right" ? "reverse" : "normal",
          } as CSSProperties
        }
      >
        {[0, 1].map((group) => (
          <div
            className="website-marquee-group"
            key={group}
            aria-hidden={group === 1 ? true : undefined}
          >
            {Array.from({ length: copies }, (_, index) => (
              <span
                key={index}
                dir="auto"
                ref={group === 0 && index === 0 ? phrase : undefined}
                data-editor-field={
                  group === 0 && index === 0 ? "text" : undefined
                }
                aria-hidden={index > 0 ? true : undefined}
                style={style}
              >
                {rawText}
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
