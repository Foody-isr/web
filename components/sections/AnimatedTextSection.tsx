"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { SectionProps } from "./SectionRenderer";
import { getFieldStyle, ensureFont } from "./typography";
import { getSectionBg } from "./sectionBg";
import { scrollingTextTypography } from "@/lib/editorialSections";
import { animatedTextPhrases, animatedTextInterval } from "@/lib/animatedText";

/** A fixed sentence with rotating endings, stable geometry and reduced-motion support. */
export function AnimatedTextSection({ section }: SectionProps) {
  const settings = section.settings || {};
  const text =
    typeof section.content.text === "string" ? section.content.text : "";
  const phrases = animatedTextPhrases(section.content.phrases);
  const phraseKey = JSON.stringify(phrases);
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;
  const [reducedMotion, setReducedMotion] = useState(true);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    ensureFont(settings.text_font);
  }, [settings.text_font]);
  useEffect(() => {
    setActive(0);
  }, [phraseKey]);
  useEffect(() => {
    if (
      phrases.length < 2 ||
      paused ||
      reducedMotion ||
      settings.show_text === false
    )
      return;
    const timer = window.setInterval(
      () => setActive((index) => (index + 1) % phrases.length),
      animatedTextInterval(settings.speed),
    );
    return () => window.clearInterval(timer);
  }, [
    phraseKey,
    phrases.length,
    settings.speed,
    settings.show_text,
    paused,
    reducedMotion,
  ]);
  if (settings.show_text === false || (!text.trim() && !phrases.length))
    return null;
  const bg = getSectionBg(settings, "site");
  const alignment = ["left", "center", "right"].includes(
    settings.text_alignment,
  )
    ? settings.text_alignment
    : "center";
  return (
    <section
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
              style={{
                color:
                  settings.rotating_color || "var(--site-link, var(--brand))",
              }}
            >
              {phrases.map((phrase, index) => (
                <span
                  key={`${index}:${phrase}`}
                  data-active={index === active % phrases.length}
                  dir="auto"
                >
                  {phrase}
                </span>
              ))}
            </span>
          </>
        )}
      </h2>
    </section>
  );
}
