"use client";

import { useEffect } from "react";
import { SectionProps } from "./SectionRenderer";
import { getHeadingClass, getBodyClass } from "./typography";

/** Font URLs for dynamic loading when per-block fonts differ from global. */
const FONT_URLS: Record<string, string> = {
  "Nunito Sans": "https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap",
  "Inter": "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap",
  "Poppins": "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap",
  "Rubik": "https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;600;700;800&display=swap",
  "Open Sans": "https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700;800&display=swap",
  "Playfair Display": "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800&display=swap",
};

type AboutBlock = {
  title?: string;
  body?: string;
  title_color?: string;
  text_color?: string;
  title_font?: string;
  body_font?: string;
  title_size?: string;
  body_size?: string;
  title_weight?: string;
  body_weight?: string;
};

function ensureFont(fontName?: string) {
  if (!fontName) return;
  const url = FONT_URLS[fontName];
  if (url && !document.querySelector(`link[href="${url}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    document.head.appendChild(link);
  }
}

/** Migrate legacy {title, body} to blocks format. */
function getBlocks(content: Record<string, any>): AboutBlock[] {
  if (Array.isArray(content.blocks) && content.blocks.length > 0) {
    return content.blocks;
  }
  if (content.title || content.body) {
    return [{ title: content.title, body: content.body }];
  }
  return [{ title: "", body: "" }];
}

/**
 * About section supporting multiple title+text blocks.
 * Each block can have individual color, font, size, and weight.
 * Section-level settings control the background color style.
 */
export function AboutSection({ section }: SectionProps) {
  const blocks = getBlocks(section.content);
  const colorStyle = section.settings?.color_style || "light";

  const colorClasses: Record<string, string> = {
    brand: "bg-[var(--brand)] text-white",
    light: "bg-[var(--surface)] text-[var(--text)]",
    dark: "bg-gray-900 text-white",
  };

  const isCustom = colorStyle === "custom";
  const customStyle = isCustom
    ? {
        backgroundColor: section.settings?.custom_bg || "#ffffff",
        color: section.settings?.custom_text || "#000000",
      }
    : undefined;

  useEffect(() => {
    for (const block of blocks) {
      ensureFont(block.title_font);
      ensureFont(block.body_font);
    }
  }, [blocks]);

  return (
    <section
      className={`py-16 px-6 ${isCustom ? "" : colorClasses[colorStyle] || colorClasses.light}`}
      style={customStyle}
    >
      <div className="max-w-3xl mx-auto text-center flex flex-col gap-8">
        {blocks.map((block, i) => (
          <div key={i} className="flex flex-col gap-3">
            {block.title && (
              <h2
                className={getHeadingClass({
                  heading_size: block.title_size || section.settings?.heading_size,
                  font_weight: block.title_weight || section.settings?.font_weight,
                })}
                style={{
                  ...(block.title_color ? { color: block.title_color } : {}),
                  ...(block.title_font ? { fontFamily: `"${block.title_font}", sans-serif` } : {}),
                }}
              >
                {block.title}
              </h2>
            )}
            {block.body && (
              <p
                className={`${getBodyClass({
                  body_size: block.body_size || section.settings?.body_size,
                })} opacity-90 whitespace-pre-line`}
                style={{
                  ...(block.text_color ? { color: block.text_color } : {}),
                  ...(block.body_font ? { fontFamily: `"${block.body_font}", sans-serif` } : {}),
                  ...(block.body_weight ? { fontWeight: block.body_weight === "bold" ? 700 : block.body_weight === "medium" ? 500 : 400 } : {}),
                }}
              >
                {block.body}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
