"use client";

import Image from "next/image";
import { SectionProps } from "./SectionRenderer";

/**
 * Eye-catching promotional banner with optional image.
 * Content: title, body, image_url, background_color
 */
export function PromoBannerSection({ section }: SectionProps) {
  const { title, body, image_url, background_color } = section.content;

  const bgStyle = background_color
    ? { backgroundColor: background_color }
    : undefined;

  return (
    <section
      className={`relative py-16 px-6 overflow-hidden ${
        !background_color ? "bg-[var(--brand)]" : ""
      } text-white`}
      style={bgStyle}
    >
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
