"use client";

import Image from "next/image";
import { SectionProps } from "./SectionRenderer";
import { getHeadingClass, getBodyClass } from "./typography";

/**
 * Side-by-side text and image section.
 * Content: title, body, image_url, image_position (left/right)
 * Settings: color_style, text_alignment, padding
 */
export function TextAndImageSection({ section }: SectionProps) {
  const { title, body, image_url, image_position } = section.content;
  const colorStyle = section.settings?.color_style || "light";
  const textAlignment = section.settings?.text_alignment || "left";
  const padding = section.settings?.padding || "normal";

  const colorClasses: Record<string, string> = {
    brand: "bg-[var(--brand)] text-white",
    light: "bg-[var(--surface)] text-[var(--text)]",
    dark: "bg-gray-900 text-white",
  };

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

  const isCustom = colorStyle === "custom";
  const customStyle = isCustom ? { backgroundColor: section.settings?.custom_bg || "#ffffff", color: section.settings?.custom_text || "#000000" } : undefined;
  const imageOnLeft = image_position === "left";

  return (
    <section
      className={`${isCustom ? "" : colorClasses[colorStyle] || colorClasses.light} ${paddingClasses[padding] || paddingClasses.normal}`}
      style={customStyle}
    >
      <div
        className={`max-w-6xl mx-auto flex flex-col gap-8 ${
          imageOnLeft ? "md:flex-row-reverse" : "md:flex-row"
        } items-center`}
      >
        <div className={`flex-1 flex flex-col gap-4 ${alignClasses[textAlignment] || alignClasses.left}`}>
          {title && (
            <h2 className={getHeadingClass(section.settings)}>{title}</h2>
          )}
          {body && (
            <p className={`${getBodyClass(section.settings)} opacity-90 whitespace-pre-line`}>
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
