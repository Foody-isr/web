"use client";

import Image from "next/image";
import Link from "next/link";
import { SectionProps } from "./SectionRenderer";
import { getHeadingClass, getBodyClass, getFieldStyle, getFieldSizeClass, ensureFont } from "./typography";
import { getSectionBg } from "./sectionBg";

/**
 * Resolve a CTA link relative to the restaurant base path.
 * Absolute URLs (http/https) and anchors (#) are returned as-is.
 * Relative paths like "/order" are prefixed with /r/{slug}.
 */
function resolveCtaLink(link: string, slug: string): string {
  if (!link) return "#";
  if (link.startsWith("http://") || link.startsWith("https://") || link.startsWith("#")) return link;
  const path = link.startsWith("/") ? link : `/${link}`;
  return `/r/${slug}${path}`;
}

/**
 * Hero banner section with support for centered, left-aligned, and split layouts.
 * Content: headline, subheadline, image_url, cta_text, cta_link
 * Settings: height, color_style, text_alignment
 */
export function HeroBannerSection({ section, restaurant }: SectionProps) {
  const { headline, subheadline, image_url, cta_text, cta_link } = section.content;
  const slug = restaurant?.slug || restaurant?.id?.toString() || "";
  const layout = section.layout || "centered";
  const settings = section.settings || {};
  const height = settings.height || "medium";
  const colorStyle = settings.color_style || "brand";
  const textAlignment = settings.text_alignment || "center";
  const bg = getSectionBg(settings, "brand");

  // Per-field typography: use field-specific settings if present, else fall back to section-level
  const hasFieldHeadline = settings.headline_color || settings.headline_font || settings.headline_size || settings.headline_weight;
  const hasFieldSubheadline = settings.subheadline_color || settings.subheadline_font || settings.subheadline_size || settings.subheadline_weight;

  // Load custom fonts
  if (typeof window !== "undefined") {
    ensureFont(settings.headline_font);
    ensureFont(settings.subheadline_font);
  }

  const heightClasses: Record<string, string> = {
    auto: "min-h-[300px]",
    compact: "min-h-[250px]",
    medium: "min-h-[400px]",
    tall: "min-h-[550px]",
    fullscreen: "min-h-screen",
  };

  const alignClasses: Record<string, string> = {
    left: "text-start items-start",
    center: "text-center items-center",
    right: "text-end items-end",
  };

  if (layout === "split") {
    return (
      <section
        className={`relative flex flex-col md:flex-row ${heightClasses[height] || heightClasses.medium} ${bg.className}`}
        style={bg.style}
      >
        {bg.overlayStyle && <div className="absolute inset-0 z-0" style={bg.overlayStyle} />}
        <div className={`relative z-10 flex-1 flex flex-col justify-center gap-4 p-8 md:p-16 ${alignClasses[textAlignment] || alignClasses.center}`}>
          {headline && (
            <h1
              className={`${hasFieldHeadline ? getFieldSizeClass(settings, 'headline', true) : getHeadingClass(settings)} leading-tight`}
              style={hasFieldHeadline ? { fontWeight: 700, ...getFieldStyle(settings, 'headline') } : undefined}
            >{headline}</h1>
          )}
          {subheadline && (
            <p
              className={`${hasFieldSubheadline ? getFieldSizeClass(settings, 'subheadline', false) : getBodyClass(settings)} opacity-90 max-w-xl`}
              style={hasFieldSubheadline ? getFieldStyle(settings, 'subheadline') : undefined}
            >{subheadline}</p>
          )}
          {cta_text && cta_link && (
            <Link
              href={resolveCtaLink(cta_link, slug)}
              className="inline-block mt-4 px-8 py-3 rounded-full bg-white text-[var(--brand)] font-semibold hover:opacity-90 transition-opacity w-fit"
            >
              {cta_text}
            </Link>
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
      className={`relative flex ${heightClasses[height] || heightClasses.medium} ${bg.className} overflow-hidden`}
      style={bg.style}
    >
      {/* Content image (foreground hero image) */}
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
      {/* Settings-based overlay (from bg_image + bg_overlay) */}
      {!image_url && bg.overlayStyle && <div className="absolute inset-0 z-0" style={bg.overlayStyle} />}
      <div
        className={`relative z-10 flex flex-col justify-center gap-4 w-full px-6 md:px-16 py-12 ${
          layout === "left_aligned"
            ? "items-start text-start"
            : "items-center text-center"
        }`}
      >
        {headline && (
          <h1
            className={`${hasFieldHeadline ? getFieldSizeClass(settings, 'headline', true) : getHeadingClass(settings)} leading-tight max-w-3xl`}
            style={hasFieldHeadline ? { fontWeight: 700, ...getFieldStyle(settings, 'headline') } : undefined}
          >
            {headline}
          </h1>
        )}
        {subheadline && (
          <p
            className={`${hasFieldSubheadline ? getFieldSizeClass(settings, 'subheadline', false) : getBodyClass(settings)} opacity-90 max-w-2xl`}
            style={hasFieldSubheadline ? getFieldStyle(settings, 'subheadline') : undefined}
          >{subheadline}</p>
        )}
        {cta_text && cta_link && (
          <Link
            href={resolveCtaLink(cta_link, slug)}
            className={`inline-block mt-4 px-8 py-3 rounded-full font-semibold transition-colors w-fit ${
              image_url || bg.hasBgImage
                ? "bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)]"
                : colorStyle === "brand"
                ? "bg-white text-[var(--brand)] hover:opacity-90"
                : "bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)]"
            }`}
          >
            {cta_text}
          </Link>
        )}
      </div>
    </section>
  );
}
