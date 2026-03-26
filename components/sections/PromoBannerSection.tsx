"use client";

import Image from "next/image";
import { SectionProps } from "./SectionRenderer";
import { getSectionBg } from "./sectionBg";

/**
 * Eye-catching promotional banner with optional image.
 * Content: title, body, image_url, background_color
 */
export function PromoBannerSection({ section }: SectionProps) {
  const { title, body, image_url } = section.content;
  const bg = getSectionBg(section.settings, "brand");

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
      {/* Settings-based overlay (from bg_image + bg_overlay) */}
      {!image_url && bg.overlayStyle && <div className="absolute inset-0 z-0" style={bg.overlayStyle} />}
      <div className="relative z-10 max-w-4xl mx-auto text-center flex flex-col gap-4">
        {title && (
          <h2 className="text-2xl md:text-4xl font-bold">{title}</h2>
        )}
        {body && (
          <p className="text-base md:text-lg opacity-90 max-w-2xl mx-auto">
            {body}
          </p>
        )}
      </div>
    </section>
  );
}
