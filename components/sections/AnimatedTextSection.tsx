"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { SectionProps } from "./SectionRenderer";
import { getFieldStyle, ensureFont } from "./typography";
import { getSectionBg } from "./sectionBg";
import { scrollingTextTypography } from "@/lib/editorialSections";
import {
  animatedTextPhrases,
  animatedTextInterval,
  animatedTextLetters,
} from "@/lib/animatedText";
import { useWebsiteMotion } from "@/hooks/useWebsiteMotion";

/** Rotates letters and resizes the ending so a centered sentence moves with each word. */
export function AnimatedTextSection({ section }: SectionProps) {
  const settings = section.settings || {};
  const text =
    typeof section.content.text === "string" ? section.content.text : "";
  const phrases = animatedTextPhrases(section.content.phrases);
  const phraseKey = JSON.stringify(phrases);
  const root = useRef<HTMLElement>(null);
  const measure = useRef<HTMLSpanElement>(null);
  const [widths, setWidths] = useState<number[]>([]);
  const [rotation, setRotation] = useState({
    active: 0,
    previous: -1,
    cycle: 0,
  });
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const allowed = useWebsiteMotion(settings.motion);
  const style = ["swirl", "fade", "slide", "none"].includes(
    settings.word_animation,
  )
    ? settings.word_animation
    : "swirl";
  const running =
    allowed && style !== "none" && settings.motion?.enabled !== false;
  const active = running ? rotation.active % Math.max(phrases.length, 1) : 0;
  const delay = Math.min(50, animatedTextInterval(settings.speed) * 0.02);
  useEffect(() => {
    ensureFont(settings.text_font);
  }, [settings.text_font]);
  useEffect(() => {
    setRotation({ active: 0, previous: -1, cycle: 0 });
  }, [phraseKey, running]);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [settings.show_text, phraseKey]);
  useEffect(() => {
    const element = measure.current;
    if (!element) return;
    // offsetWidth ignores a parent's entry zoom; transformed bounds do not.
    const update = () =>
      setWidths(
        Array.from(
          element.children,
          (child) => (child as HTMLElement).offsetWidth + 2,
        ),
      );
    update();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    Array.from(element.children).forEach((child) => observer?.observe(child));
    document.fonts?.addEventListener("loadingdone", update);
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      document.fonts?.removeEventListener("loadingdone", update);
      window.removeEventListener("resize", update);
    };
  }, [
    phraseKey,
    settings.text_font,
    settings.text_size,
    settings.text_bold,
    settings.text_italic,
    settings.text_uppercase,
    settings.show_text,
  ]);
  useEffect(() => {
    if (
      phrases.length < 2 ||
      !running ||
      !visible ||
      hovered ||
      focused ||
      settings.show_text === false
    )
      return;
    const count = Math.max(
      ...(JSON.parse(phraseKey) as string[]).map(
        (phrase) => animatedTextLetters(phrase).length,
      ),
    );
    const timer = window.setTimeout(
      () =>
        setRotation((value) => ({
          active: (value.active + 1) % phrases.length,
          previous: value.active,
          cycle: value.cycle + 1,
        })),
      animatedTextInterval(settings.speed) + Math.min(count, 60) * delay,
    );
    return () => window.clearTimeout(timer);
  }, [
    phraseKey,
    phrases.length,
    settings.speed,
    settings.show_text,
    running,
    visible,
    hovered,
    focused,
    rotation.cycle,
    delay,
  ]);
  if (settings.show_text === false || (!text.trim() && !phrases.length))
    return null;
  const bg = getSectionBg(settings, "site");
  const alignment = ["left", "center", "right"].includes(
    settings.text_alignment,
  )
    ? settings.text_alignment
    : "center";
  const width =
    settings.resize_width === false ? Math.max(...widths, 0) : widths[active];
  return (
    <section
      ref={root}
      className={`website-animated-text ${bg.className}`}
      data-spacing={settings.padding || "compact"}
      style={{ ...bg.style, textAlign: alignment } as CSSProperties}
      tabIndex={phrases.length > 1 ? 0 : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <h2
        style={{
          ...getFieldStyle(settings, "text"),
          ...scrollingTextTypography({ text_size: "md", ...settings }),
          color: settings.text_color || "var(--site-title, inherit)",
          lineHeight: 1.2,
        }}
      >
        <span data-editor-field="text">{text}</span>
        {text && phrases.length > 0 ? " " : null}
        {phrases.length > 0 && (
          <>
            <span className="sr-only">{phrases.join(", ")}</span>
            <span
              className="website-animated-phrases"
              aria-hidden="true"
              data-word-animation={running ? style : "none"}
              style={{
                color:
                  settings.rotating_color || "var(--site-link, var(--brand))",
                width: width || undefined,
              }}
            >
              {phrases.map((phrase, index) => (
                <span
                  key={`${index}:${phrase}`}
                  data-active={index === active}
                  data-word-state={
                    !running || rotation.cycle === 0
                      ? index === active
                        ? "steady"
                        : "hidden"
                      : index === active
                        ? "in"
                        : index === rotation.previous
                          ? "out"
                          : "hidden"
                  }
                  dir="auto"
                >
                  {animatedTextLetters(phrase).map((letter, i) => (
                    <span
                      className="website-animated-letter"
                      key={`${rotation.cycle}:${i}`}
                      style={{ animationDelay: `${Math.min(i, 60) * delay}ms` }}
                    >
                      {letter === " " ? "\u00a0" : letter}
                    </span>
                  ))}
                </span>
              ))}
            </span>
            <span
              ref={measure}
              className="website-animated-measure"
              aria-hidden="true"
            >
              {phrases.map((phrase, index) => (
                <span key={index}>
                  {animatedTextLetters(phrase).map((letter, i) => (
                    <span className="website-animated-letter" key={i}>
                      {letter === " " ? "\u00a0" : letter}
                    </span>
                  ))}
                </span>
              ))}
            </span>
          </>
        )}
      </h2>
    </section>
  );
}
