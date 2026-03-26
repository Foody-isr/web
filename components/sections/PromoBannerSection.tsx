"use client";

import Image from "next/image";
import { SectionProps } from "./SectionRenderer";
import { getFieldStyle, getFieldSizeClass, ensureFont } from "./typography";
import { getSectionBg } from "./sectionBg";

/**
 * Eye-catching promotional banner with optional image.
 * Content: title, body, image_url, background_color
 */
export function PromoBannerSection({ section }: SectionProps) {
  const { title, body, image_url } = section.content;
  const settings = section.settings || {};
  const bg = getSectionBg(settings, "brand");

  const hasFieldTitle = settings.title_color || settings.title_font || settings.title_size || settings.title_weight;
  const hasFieldBody = settings.body_color || settings.body_font || settings.body_size || settings.body_weight;

  if (typeof window !== "undefined") {
    ensureFont(settings.title_font);
    ensureFont(settings.body_font);
  }

  return (
    <section
      className={`relative py-16 px-6 overflow-hidden ${bg.className}`}
      style={bg.style}
    >
      {/* Legacy content image (separate from bg_image in settings) */}
      {image_url && (
        <>
          <Image
            src={image_url}
            alt={title || "Promotional banner"}
            fill
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-black/50" />
        </>
      )}
      <div className="relative z-10 max-w-4xl mx-auto text-center flex flex-col gap-4" style={{ paddingTop: 'var(--logo-offset, 0px)' }}>
        {title && (
          <h2
            className={hasFieldTitle ? getFieldSizeClass(settings, 'title', true) : "text-2xl md:text-4xl"}
            style={hasFieldTitle ? { fontWeight: 700, ...getFieldStyle(settings, 'title') } : { fontWeight: 700 }}
          >{title}</h2>
        )}
        {body && (
          <p
            className={`${hasFieldBody ? getFieldSizeClass(settings, 'body', false) : "text-base md:text-lg"} opacity-90 max-w-2xl mx-auto`}
            style={hasFieldBody ? getFieldStyle(settings, 'body') : undefined}
          >
            {body}
          </p>
        )}
      </div>
    </section>
  );
}
