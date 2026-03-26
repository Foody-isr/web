"use client";

import { useEffect } from "react";
import { SectionProps } from "./SectionRenderer";
import { getHeadingClass, getBodyClass, getFieldStyle, getFieldSizeClass, ensureFont } from "./typography";
import { getSectionBg } from "./sectionBg";

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
  const bg = getSectionBg(section.settings);

  useEffect(() => {
    for (const block of blocks) {
      ensureFont(block.title_font);
      ensureFont(block.body_font);
    }
  }, [blocks]);

  return (
    <section
      className={`relative py-16 px-6 ${bg.className}`}
      style={bg.style}
    >
      <div className="relative z-10 max-w-3xl mx-auto text-center flex flex-col gap-8" style={{ paddingTop: 'var(--logo-offset, 0px)' }}>
        {blocks.map((block, i) => {
          const hasTitle = block.title_color || block.title_font || block.title_size || block.title_weight;
          const hasBody = block.text_color || block.body_font || block.body_size || block.body_weight;
          return (
            <div key={i} className="flex flex-col gap-3">
              {block.title && (
                <h2
                  className={hasTitle
                    ? getFieldSizeClass(block as Record<string, any>, 'title', true)
                    : getHeadingClass({
                        heading_size: block.title_size || section.settings?.heading_size,
                        font_weight: block.title_weight || section.settings?.font_weight,
                      })
                  }
                  style={hasTitle ? { fontWeight: 700, ...getFieldStyle(block as Record<string, any>, 'title') } : {
                    ...(block.title_color ? { color: block.title_color } : {}),
                    ...(block.title_font ? { fontFamily: `"${block.title_font}", sans-serif` } : {}),
                  }}
                >
                  {block.title}
                </h2>
              )}
              {block.body && (
                <p
                  className={`${hasBody
                    ? getFieldSizeClass(block as Record<string, any>, 'text', false)
                    : getBodyClass({
                        body_size: block.body_size || section.settings?.body_size,
                      })
                  } opacity-90 whitespace-pre-line`}
                  style={hasBody ? getFieldStyle(block as Record<string, any>, 'text') : {
                    ...(block.text_color ? { color: block.text_color } : {}),
                    ...(block.body_font ? { fontFamily: `"${block.body_font}", sans-serif` } : {}),
                    ...(block.body_weight ? { fontWeight: block.body_weight === "bold" ? 700 : block.body_weight === "medium" ? 500 : 400 } : {}),
                  }}
                >
                  {block.body}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
