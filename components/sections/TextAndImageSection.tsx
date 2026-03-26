"use client";

import Image from "next/image";
import { SectionProps } from "./SectionRenderer";
import { getHeadingClass, getBodyClass, getFieldStyle, getFieldSizeClass, ensureFont } from "./typography";
import { getSectionBg } from "./sectionBg";

/**
 * Side-by-side text and image section.
 * Content: title, body, image_url, image_position (left/right)
 * Settings: color_style, text_alignment, padding
 */
export function TextAndImageSection({ section }: SectionProps) {
  const { title, body, image_url, image_position } = section.content;
  const settings = section.settings || {};
  const textAlignment = settings.text_alignment || "left";
  const padding = settings.padding || "normal";
  const bg = getSectionBg(settings);

  const hasFieldTitle = settings.title_color || settings.title_font || settings.title_size || settings.title_weight;
  const hasFieldBody = settings.body_color || settings.body_font || settings.body_size || settings.body_weight;

  if (typeof window !== "undefined") {
    ensureFont(settings.title_font);
    ensureFont(settings.body_font);
  }

  const paddingClasses: Record<string, string> = {
    compact: "py-8 px-4",
    normal: "py-16 px-6",
    spacious: "py-24 px-8",
  };

  const alignClasses: Record<string, string> = {
    left: "text-start",
    center: "text-center",
    right: "text-end",
  };

  const imageOnLeft = image_position === "left";

  return (
    <section
      className={`relative ${bg.className} ${paddingClasses[padding] || paddingClasses.normal}`}
      style={bg.style}
    >
      {bg.overlayStyle && <div className="absolute inset-0 z-0" style={bg.overlayStyle} />}
      <div
        className={`relative z-10 max-w-6xl mx-auto flex flex-col gap-8 ${
          imageOnLeft ? "md:flex-row-reverse" : "md:flex-row"
        } items-center`}
      >
        <div className={`flex-1 flex flex-col gap-4 ${alignClasses[textAlignment] || alignClasses.left}`}>
          {title && (
            <h2
              className={hasFieldTitle ? getFieldSizeClass(settings, 'title', true) : getHeadingClass(settings)}
              style={hasFieldTitle ? { fontWeight: 700, ...getFieldStyle(settings, 'title') } : undefined}
            >{title}</h2>
          )}
          {body && (
            <p
              className={`${hasFieldBody ? getFieldSizeClass(settings, 'body', false) : getBodyClass(settings)} opacity-90 whitespace-pre-line`}
              style={hasFieldBody ? getFieldStyle(settings, 'body') : undefined}
            >
              {body}
            </p>
          )}
        </div>
        {image_url && (
          <div className="flex-1 relative w-full aspect-[4/3] rounded-xl overflow-hidden">
            <Image
              src={image_url}
              alt={title || "Section image"}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        )}
      </div>
    </section>
  );
}
