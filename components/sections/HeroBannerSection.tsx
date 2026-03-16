"use client";

import Image from "next/image";
import { SectionProps } from "./SectionRenderer";

/**
 * Hero banner section with support for centered, left-aligned, and split layouts.
 * Content: headline, subheadline, image_url, cta_text, cta_link
 * Settings: height, color_style, text_alignment
 */
export function HeroBannerSection({ section }: SectionProps) {
  const { headline, subheadline, image_url, cta_text, cta_link } = section.content;
  const layout = section.layout || "centered";
  const height = section.settings?.height || "medium";
  const colorStyle = section.settings?.color_style || "brand";
  const textAlignment = section.settings?.text_alignment || "center";

  const heightClasses: Record<string, string> = {
    auto: "min-h-[300px]",
    compact: "min-h-[250px]",
    medium: "min-h-[400px]",
    tall: "min-h-[550px]",
    fullscreen: "min-h-screen",
  };

  const colorClasses: Record<string, string> = {
    brand: "bg-[var(--brand)] text-white",
    light: "bg-[var(--surface)] text-[var(--text)]",
    dark: "bg-gray-900 text-white",
  };

  const isCustom = colorStyle === "custom";
  const customStyle = isCustom ? { backgroundColor: section.settings?.custom_bg || "#ffffff", color: section.settings?.custom_text || "#000000" } : undefined;

  const alignClasses: Record<string, string> = {
    left: "text-start items-start",
    center: "text-center items-center",
    right: "text-end items-end",
  };

  if (layout === "split") {
    return (
      <section
        className={`relative flex flex-col md:flex-row ${heightClasses[height] || heightClasses.medium} ${isCustom ? "" : colorClasses[colorStyle] || colorClasses.brand}`}
        style={customStyle}
      >
        <div className={`flex-1 flex flex-col justify-center gap-4 p-8 md:p-16 ${alignClasses[textAlignment] || alignClasses.center}`}>
          {headline && (
            <h1 className="text-3xl md:text-5xl font-bold leading-tight">{headline}</h1>
          )}
          {subheadline && (
            <p className="text-lg md:text-xl opacity-90 max-w-xl">{subheadline}</p>
          )}
          {cta_text && cta_link && (
            <a
              href={cta_link}
              className="inline-block mt-4 px-8 py-3 rounded-full bg-white text-[var(--brand)] font-semibold hover:opacity-90 transition-opacity w-fit"
            >
              {cta_text}
            </a>
          )}
        </div>
        {image_url && (
          <div className="flex-1 relative min-h-[250px]">
            <Image
              src={image_url}
              alt={headline || "Hero banner"}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
            />
          </div>
        )}
      </section>
    );
  }

  return (
    <section
      className={`relative flex ${heightClasses[height] || heightClasses.medium} ${isCustom ? "" : colorClasses[colorStyle] || colorClasses.brand} overflow-hidden`}
      style={customStyle}
    >
      {image_url && (
        <Image
          src={image_url}
          alt={headline || "Hero banner"}
          fill
          className="object-cover"
          sizes="100vw"
          priority
        />
      )}
      {image_url && <div className="absolute inset-0 bg-black/40" />}
      <div
        className={`relative z-10 flex flex-col justify-center gap-4 w-full px-6 md:px-16 py-12 ${
          layout === "left_aligned"
            ? "items-start text-start"
            : "items-center text-center"
        }`}
      >
        {headline && (
          <h1 className="text-3xl md:text-5xl font-bold leading-tight max-w-3xl">
            {headline}
          </h1>
        )}
        {subheadline && (
          <p className="text-lg md:text-xl opacity-90 max-w-2xl">{subheadline}</p>
        )}
        {cta_text && cta_link && (
          <a
            href={cta_link}
            className={`inline-block mt-4 px-8 py-3 rounded-full font-semibold transition-colors w-fit ${
              image_url
                ? "bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)]"
                : colorStyle === "brand"
                ? "bg-white text-[var(--brand)] hover:opacity-90"
                : "bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)]"
            }`}
          >
            {cta_text}
          </a>
        )}
      </div>
    </section>
  );
}
