"use client";

import Image from "next/image";
import { SectionProps } from "./SectionRenderer";
import { getSectionBg } from "./sectionBg";

type GalleryImage = {
  url: string;
  alt?: string;
};

/**
 * Responsive image gallery grid.
 * Content: images array [{url, alt}]
 * 2 columns on mobile, 3 on desktop.
 */
export function GallerySection({ section }: SectionProps) {
  const images: GalleryImage[] = section.content?.images || [];
  const bg = getSectionBg(section.settings);

  if (images.length === 0) return null;

  return (
    <section className={`relative py-16 px-6 ${bg.className}`} style={bg.style}>
      <div
        className={`relative z-10 max-w-6xl mx-auto gap-4 ${section.layout === "carousel" ? "flex overflow-x-auto snap-x" : section.layout === "masonry" ? "columns-2 md:columns-3 space-y-4" : "grid grid-cols-2 md:grid-cols-3"}`}
      >
        {images.map((img, i) => (
          <div
            key={i}
            className={`relative overflow-hidden group ${section.layout === "carousel" ? "shrink-0 w-[80%] md:w-[45%] aspect-[4/3] snap-center" : section.layout === "masonry" ? "break-inside-avoid" : "aspect-square"}`}
          >
            <Image
              src={img.url}
              alt={img.alt || `Gallery image ${i + 1}`}
              fill={section.layout !== "masonry"}
              width={section.layout === "masonry" ? 1000 : undefined}
              height={section.layout === "masonry" ? 1000 : undefined}
              className={`object-cover transition-transform duration-300 ${section.settings?.motion ? "" : "group-hover:scale-105"}`}
              sizes="(max-width: 768px) 50vw, 33vw"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
