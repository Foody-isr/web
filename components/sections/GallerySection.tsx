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
      <div className="relative z-10 max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-3 gap-4" style={{ paddingTop: 'var(--logo-offset, 0px)' }}>
        {images.map((img, i) => (
          <div
            key={i}
            className="relative aspect-square rounded-xl overflow-hidden group"
          >
            <Image
              src={img.url}
              alt={img.alt || `Gallery image ${i + 1}`}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 768px) 50vw, 33vw"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
