"use client";

import { SectionProps } from "./SectionRenderer";

/**
 * Simple text block section for restaurant about/story content.
 * Content: title, body
 * Settings: color_style
 */
export function AboutSection({ section }: SectionProps) {
  const { title, body } = section.content;
  const colorStyle = section.settings?.color_style || "light";

  const colorClasses: Record<string, string> = {
    brand: "bg-[var(--brand)] text-white",
    light: "bg-[var(--surface)] text-[var(--text)]",
    dark: "bg-gray-900 text-white",
  };

  const isCustom = colorStyle === "custom";
  const customStyle = isCustom ? { backgroundColor: section.settings?.custom_bg || "#ffffff", color: section.settings?.custom_text || "#000000" } : undefined;

  return (
    <section
      className={`py-16 px-6 ${isCustom ? "" : colorClasses[colorStyle] || colorClasses.light}`}
      style={customStyle}
    >
      <div className="max-w-3xl mx-auto text-center flex flex-col gap-4">
        {title && (
          <h2 className="text-2xl md:text-3xl font-bold">{title}</h2>
        )}
        {body && (
          <p className="text-base md:text-lg leading-relaxed opacity-90 whitespace-pre-line">
            {body}
          </p>
        )}
      </div>
    </section>
  );
}
