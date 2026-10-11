"use client";

import Image from "next/image";
import { useEffect, type CSSProperties } from "react";
import { websiteContentUrl, websiteMediaUrl } from "@/lib/websiteComponents";
import { textImageLayout, textImageGroups } from "@/lib/editorialSections";
import { resolveRestaurantWebsiteHref } from "@/lib/restaurantWebsiteLink";
import type { SectionProps } from "./SectionRenderer";
import {
  getHeadingClass,
  getBodyClass,
  getFieldStyle,
  ensureFont,
} from "./typography";
import { getSectionBg } from "./sectionBg";

/** Editable text/media compositions, including edge-to-edge media and independent groups. */
export function TextAndImageSection({ section, restaurant }: SectionProps) {
  const s = section.settings || {};
  const layout = textImageLayout(section.layout, s, section.content);
  const bg = getSectionBg({
    ...s,
    bg_size: s.image_fit || s.bg_size,
    bg_position: s.image_position || s.bg_position,
  });
  useEffect(() => {
    ensureFont(s.title_font);
    ensureFont(s.body_font);
    ensureFont(s.cta_font);
  }, [s.title_font, s.body_font, s.cta_font]);
  const heights: Record<string, string> = {
    compact: "240px",
    medium: "400px",
    tall: "560px",
    full: "720px",
  };
  const height = heights[s.height] || (s.image_only ? "480px" : "400px");
  return (
    <section
      className={`website-text-image ${bg.className}`}
      data-layout={layout}
      data-spacing={s.padding || "normal"}
      data-align={s.text_alignment || "left"}
      style={
        {
          ...bg.style,
          ...(bg.hasBgImage ? { minHeight: height } : {}),
          "--editorial-media-height": height,
        } as CSSProperties
      }
    >
      <div className="website-text-image-groups">
        {textImageGroups(section.content).map((group, index) => {
          const title = group.title && s.show_title !== false && !s.image_only;
          const body = group.body && s.show_body !== false && !s.image_only;
          const cta =
            group.cta_text && s.show_cta_text !== false && !s.image_only;
          const media =
            s.show_image_url !== false
              ? websiteMediaUrl(group.image_url)
              : null;
          const link = websiteContentUrl(group.cta_link);
          const href = link
            ? resolveRestaurantWebsiteHref(
                link,
                restaurant.slug || String(restaurant.id),
              )
            : null;
          const field = (name: string) => (index === 0 ? name : undefined);
          return (
            <div
              key={index}
              className="website-text-image-group"
              data-image-only={Boolean(s.image_only)}
              data-has-text={Boolean(title || body || cta)}
              data-has-image={Boolean(media)}
            >
              {media && (
                <div className="website-text-image-media" data-motion-part="media">
                  <Image
                    data-editor-field={field("image_url")}
                    src={media}
                    alt={
                      typeof group.image_alt === "string"
                        ? group.image_alt
                        : String(group.title || "")
                    }
                    fill
                    sizes={
                      layout.startsWith("split_") ||
                      [
                        "default",
                        "image_left",
                        "columns",
                        "columns_title_top",
                        "columns_centered",
                      ].includes(layout)
                        ? "(max-width: 767px) 100vw, 50vw"
                        : "100vw"
                    }
                    style={{
                      objectFit:
                        s.image_fit === "contain" ? "contain" : "cover",
                      objectPosition: ["top", "center", "bottom"].includes(
                        s.image_position,
                      )
                        ? s.image_position
                        : "center",
                    }}
                  />
                </div>
              )}
              {(title || body || cta) && (
                <div className="website-text-image-copy" data-motion-part="text">
                  {title && (
                    <h2
                      data-editor-field={field("title")}
                      className={getHeadingClass(s)}
                      style={getFieldStyle(s, "title")}
                    >
                      {String(group.title)}
                    </h2>
                  )}
                  {body && (
                    <p
                      data-editor-field={field("body")}
                      className={`${getBodyClass(s)} whitespace-pre-line`}
                      style={getFieldStyle(s, "body")}
                    >
                      {String(group.body)}
                    </p>
                  )}
                  {cta && (
                    <a
                      data-editor-field={field("cta_text")}
                      href={href ?? undefined}
                      aria-disabled={!href}
                      className="inline-flex px-7 py-3.5 rounded-[var(--site-button-radius,999px)] bg-[var(--site-solid,var(--brand))] text-[var(--site-solid-ink,var(--ink-on-accent))]"
                      style={{
                        ...getFieldStyle(s, "cta"),
                        ...(s.cta_bg_color
                          ? { backgroundColor: s.cta_bg_color }
                          : {}),
                      }}
                    >
                      {String(group.cta_text)}
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
