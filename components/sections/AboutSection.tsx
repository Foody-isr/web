"use client";

import { useEffect } from "react";
import { SectionProps } from "./SectionRenderer";
import { getHeadingClass, getBodyClass, getFieldStyle, getFieldSizeClass, ensureFont } from "./typography";
import { getSectionBg } from "./sectionBg";

type AboutBlock = {
  title?: string;
  body?: string;
  image_url?: string;
  title_color?: string;
  text_color?: string;
  title_font?: string;
  text_font?: string;
  title_size?: string;
  text_size?: string;
  title_weight?: string;
  text_weight?: string;
};

const WIDTH_CLASSES: Record<string, string> = {
  narrow: "max-w-xl",
  normal: "max-w-3xl",
  wide: "max-w-5xl",
};

const PADDING_CLASSES: Record<string, string> = {
  compact: "py-8",
  normal: "py-16",
  spacious: "py-24",
};

const ALIGN_CLASSES: Record<string, string> = {
  left: "text-left items-start",
  center: "text-center items-center",
  right: "text-right items-end",
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
 * Background for an About section. Unlike other sections, when a background image
 * is present the darkening overlay defaults ON and text defaults to white, so the
 * copy stays readable without the owner having to configure anything.
 */
function getAboutBg(settings: Record<string, any> | undefined) {
  const s = settings || {};
  const hasImg = !!s.bg_image;
  if (!hasImg) return getSectionBg(s);
  const overlayOn = s.bg_overlay !== false; // default ON when an image is set
  const eff = {
    ...s,
    bg_overlay: overlayOn,
    bg_overlay_opacity: s.bg_overlay_opacity ?? 45,
  };
  const res = getSectionBg(eff);
  if (s.color_style !== "custom") {
    res.style = { ...res.style, color: "#ffffff" };
  }
  return res;
}

/** One title+text(+image) block, with per-block typography overrides. */
function AboutBlockView({ block, settings }: { block: AboutBlock; settings: Record<string, any> }) {
  const hasTitle = block.title_color || block.title_font || block.title_size || block.title_weight;
  const hasBody = block.text_color || block.text_font || block.text_size || block.text_weight;
  return (
    <div className="flex flex-col gap-3 w-full">
      {block.image_url && (
        <img src={block.image_url} alt="" className="rounded-xl w-full object-cover max-h-80" />
      )}
      {block.title && (
        <h2
          className={hasTitle
            ? getFieldSizeClass(block as Record<string, any>, "title", true)
            : getHeadingClass({
                heading_size: block.title_size || settings?.heading_size,
                font_weight: block.title_weight || settings?.font_weight,
              })
          }
          style={hasTitle ? { fontWeight: 700, ...getFieldStyle(block as Record<string, any>, "title") } : {}}
        >
          {block.title}
        </h2>
      )}
      {block.body && (
        <p
          className={`${hasBody
            ? getFieldSizeClass(block as Record<string, any>, "text", false)
            : getBodyClass({ body_size: block.text_size || settings?.body_size })
          } opacity-90 whitespace-pre-line`}
          style={hasBody ? getFieldStyle(block as Record<string, any>, "text") : {}}
        >
          {block.body}
        </p>
      )}
    </div>
  );
}

/**
 * About section with three layouts (centered / split / banner), configurable
 * alignment, width, spacing, an optional CTA button, and per-block images.
 * When a background image is set, text is kept readable automatically (see getAboutBg).
 */
export function AboutSection({ section }: SectionProps) {
  const blocks = getBlocks(section.content);
  const settings = section.settings || {};
  const layout = section.layout === "split" || section.layout === "banner" ? section.layout : "centered";
  const bg = getAboutBg(settings);

  const width = WIDTH_CLASSES[settings.content_width as string] || WIDTH_CLASSES.normal;
  const padding = PADDING_CLASSES[settings.padding as string] || PADDING_CLASSES.normal;
  const align =
    ALIGN_CLASSES[(settings.text_align as string) || (layout === "split" ? "left" : "center")] ||
    ALIGN_CLASSES.center;

  const ctaLabel = (settings.cta_label as string) || "";
  const ctaLink = (settings.cta_link as string) || "";

  useEffect(() => {
    for (const block of blocks) {
      ensureFont(block.title_font);
      ensureFont(block.text_font);
    }
  }, [blocks]);

  const cta = ctaLabel ? (
    <a
      href={ctaLink || undefined}
      className="inline-block mt-2 px-6 py-3 rounded-full font-semibold bg-[var(--brand)] text-white hover:opacity-90 transition-opacity"
    >
      {ctaLabel}
    </a>
  ) : null;

  const blockViews = blocks.map((block, i) => (
    <AboutBlockView key={i} block={block} settings={settings} />
  ));

  if (layout === "split") {
    const imageRight = settings.image_side === "right";
    const img = settings.image_url as string;
    return (
      <section className={`relative ${padding} px-6 ${bg.className}`} style={bg.style}>
        <div className="relative z-10 max-w-6xl mx-auto grid gap-10 md:grid-cols-2 items-center">
          <div className={imageRight ? "md:order-2" : ""}>
            {img ? (
              <img src={img} alt="" className="rounded-2xl w-full object-cover max-h-[28rem]" />
            ) : (
              <div className="rounded-2xl w-full aspect-[4/3] bg-black/5" />
            )}
          </div>
          <div className={`flex flex-col gap-6 ${align}`}>
            {blockViews}
            {cta}
          </div>
        </div>
      </section>
    );
  }

  // centered + banner share the single-column layout; banner adds min-height.
  const bannerClass = layout === "banner" ? "min-h-[60vh] flex items-center" : "";
  return (
    <section className={`relative ${padding} px-6 ${bannerClass} ${bg.className}`} style={bg.style}>
      <div className={`relative z-10 ${width} mx-auto flex flex-col gap-8 w-full ${align}`}>
        {blockViews}
        {cta}
      </div>
    </section>
  );
}
