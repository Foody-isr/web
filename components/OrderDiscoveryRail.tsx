"use client";

import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { Restaurant, WebsiteSection } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { localizeSection } from "@/lib/sectionLocale";
import { resolveRestaurantWebsiteHref } from "@/lib/restaurantWebsiteLink";
import { websiteV3SectionFieldHooks } from "@/lib/websiteV3FieldHooks";

type DiscoveryPromotion = {
  image_url?: string;
  image_alt?: string;
  image_focal_x?: number;
  image_focal_y?: number;
  eyebrow?: string;
  title?: string;
  description?: string;
  cta_label?: string;
  link?: string;
  open_in_new_tab?: boolean;
};

type PreparedPromotion = DiscoveryPromotion & {
  href: string | null;
};

/** Renders one builder-owned discovery section inside the order catalog. */
export function OrderDiscoveryRail({
  section,
  restaurant,
  desktopGap,
}: {
  section: WebsiteSection;
  restaurant: Restaurant;
  desktopGap: "compact" | "regular";
}) {
  const { locale, t, direction } = useI18n();
  const localized = localizeSection(section, locale);
  const restaurantSlug = restaurant.slug || String(restaurant.id);
  const promotions = recordList(localized.content.promotions).flatMap(
    (promotion): PreparedPromotion[] => {
      if (!text(promotion.title) && !text(promotion.image_url)) return [];
      return [
        {
          ...(promotion as DiscoveryPromotion),
          href: resolveRestaurantWebsiteHref(
            text(promotion.link),
            restaurantSlug,
          ),
        },
      ];
    },
  );

  if (promotions.length === 0) return null;

  const settings = localized.settings;
  const headingEyebrow = text(localized.content.heading_eyebrow);
  const heading = text(localized.content.heading);
  const showHeading = localized.content.show_heading !== false;
  const headingId = `order-discovery-title-${section.id}`;
  const desktopGapClass =
    desktopGap === "compact" ? "lg:gap-3" : "lg:gap-4";
  const heightClass = discoveryHeightClass(text(settings.card_height));
  const radiusClass = discoveryRadiusClass(text(settings.card_radius));
  const showDividers = settings.show_dividers !== false;
  const sectionStyle: CSSProperties = {};
  if (text(settings.section_bg_color)) {
    sectionStyle.backgroundColor = text(settings.section_bg_color);
  }
  if (text(settings.divider_color)) {
    sectionStyle.borderColor = text(settings.divider_color);
  }

  return (
    <section
      data-website-section={section.sectionType}
      data-section-id={section.id}
      {...websiteV3SectionFieldHooks(section)}
      aria-labelledby={showHeading && heading ? headingId : undefined}
      aria-label={
        showHeading && heading
          ? undefined
          : headingEyebrow || heading || t("discoverEyebrow") || "Discovery"
      }
      className={`col-span-full my-7 py-7 sm:my-10 sm:py-9 ${showDividers ? "border-y border-[var(--divider)]" : ""}`}
      style={sectionStyle}
    >
      {showHeading && (headingEyebrow || heading) ? (
        <div className="mb-5">
          {headingEyebrow ? (
            <p
              className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]"
              style={colorStyle(settings.heading_eyebrow_color)}
            >
              {headingEyebrow}
            </p>
          ) : null}
          {heading ? (
            <h2
              id={headingId}
              className="text-2xl font-bold leading-tight text-[var(--text)] sm:text-3xl"
              style={{
                fontFamily: "var(--font-display)",
                ...colorStyle(settings.heading_color),
              }}
            >
              {heading}
            </h2>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-4">
        {promotions.map((promotion, index) => {
          const imageOnStart = discoveryImageOnStart(
            text(settings.image_position),
            index,
          );
          const wrapperClass = `group block h-56 w-full overflow-hidden bg-[var(--surface-subtle)] shadow-[0_10px_30px_var(--shadow-color)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand)] sm:aspect-[16/7] sm:h-auto lg:grid lg:aspect-auto lg:grid-cols-3 ${desktopGapClass} lg:overflow-visible lg:rounded-none lg:bg-transparent lg:shadow-none ${radiusClass}`;
          const content = (
            <DiscoveryPromotionContent
              promotion={promotion}
              imageOnStart={imageOnStart}
              settings={settings}
              heightClass={heightClass}
              radiusClass={radiusClass}
              discoverLabel={t("discoverAction") || "Discover"}
              arrow={direction === "rtl" ? "←" : "→"}
            />
          );

          return promotion.href ? (
            <Link
              key={`${promotion.href}-${index}`}
              href={promotion.href}
              target={promotion.open_in_new_tab ? "_blank" : undefined}
              rel={promotion.open_in_new_tab ? "noreferrer" : undefined}
              className={wrapperClass}
            >
              {content}
            </Link>
          ) : (
            <article key={index} className={wrapperClass}>
              {content}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DiscoveryPromotionContent({
  promotion,
  imageOnStart,
  settings,
  heightClass,
  radiusClass,
  discoverLabel,
  arrow,
}: {
  promotion: PreparedPromotion;
  imageOnStart: boolean;
  settings: Record<string, unknown>;
  heightClass: string;
  radiusClass: string;
  discoverLabel: string;
  arrow: string;
}) {
  const panelStyle = discoveryPanelStyle(settings);
  const buttonStyle = discoveryButtonStyle(settings);
  const overlayOpacity = clampNumber(settings.mobile_overlay_opacity, 0.72, 0, 0.95);
  const ctaLabel = text(promotion.cta_label) || discoverLabel;
  const imageColumnClass = imageOnStart
    ? "lg:col-span-2 lg:col-start-1"
    : "lg:col-span-2 lg:col-start-2";
  const panelColumnClass = imageOnStart
    ? "lg:col-start-3"
    : "lg:col-start-1 lg:row-start-1";

  return (
    <>
      <div
        className={`${imageColumnClass} ${heightClass} relative h-full overflow-hidden ${radiusClass}`}
      >
        {promotion.image_url ? (
          <Image
            src={promotion.image_url}
            alt={promotion.image_alt || ""}
            fill
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.025] motion-reduce:transition-none"
            style={{
              objectPosition: `${focalPoint(promotion.image_focal_x)}% ${focalPoint(promotion.image_focal_y)}%`,
            }}
            sizes="(max-width: 1024px) 100vw, 66vw"
          />
        ) : (
          <div className="absolute inset-0 bg-[var(--surface-subtle)]" />
        )}
        <div
          className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent transition-opacity group-hover:opacity-90 lg:hidden"
          style={{ opacity: overlayOpacity }}
        />
        <div
          className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 text-white sm:p-6 lg:hidden"
          style={colorStyle(settings.mobile_text_color)}
        >
          <div className="min-w-0">
            {promotion.eyebrow ? (
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] opacity-75">
                {promotion.eyebrow}
              </p>
            ) : null}
            {promotion.title ? (
              <h3
                className="text-xl font-bold leading-tight sm:text-2xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {promotion.title}
              </h3>
            ) : null}
            {promotion.description ? (
              <p className="mt-1 line-clamp-2 max-w-xl text-sm opacity-85">
                {promotion.description}
              </p>
            ) : null}
          </div>
          {promotion.href ? (
            <span
              aria-hidden="true"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/15 text-xl font-semibold shadow-lg transition-transform group-hover:scale-105"
              style={buttonStyle}
            >
              {arrow}
            </span>
          ) : null}
        </div>
      </div>

      <div
        className={`${panelColumnClass} ${heightClass} hidden flex-col justify-center border border-[var(--divider)] p-8 shadow-[0_10px_30px_var(--shadow-color)] lg:flex xl:p-10 ${radiusClass}`}
        style={panelStyle}
      >
        {promotion.eyebrow ? (
          <p
            className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-75"
            style={colorStyle(settings.panel_muted_color)}
          >
            {promotion.eyebrow}
          </p>
        ) : null}
        {promotion.title ? (
          <h3
            className={`${promotion.eyebrow ? "mt-4" : ""} text-2xl font-bold leading-tight xl:text-3xl`}
            style={{ fontFamily: "var(--font-display)" }}
          >
            {promotion.title}
          </h3>
        ) : null}
        {promotion.description ? (
          <p
            className="mt-5 max-w-sm text-sm leading-6 opacity-85 xl:text-base"
            style={colorStyle(settings.panel_muted_color)}
          >
            {promotion.description}
          </p>
        ) : null}
        {promotion.href ? (
          <span
            className="mt-8 inline-flex min-h-11 w-fit items-center gap-4 rounded-full px-6 py-3 text-sm font-bold uppercase tracking-wide shadow-sm transition-transform group-hover:translate-x-1 motion-reduce:transition-none"
            style={buttonStyle}
          >
            {ctaLabel}
            <span aria-hidden="true">{arrow}</span>
          </span>
        ) : null}
      </div>
    </>
  );
}

function discoveryPanelStyle(settings: Record<string, unknown>): CSSProperties {
  const start = text(settings.panel_bg_color) || "var(--surface)";
  const end =
    text(settings.panel_bg_color_end) || "var(--surface-subtle)";
  return {
    background:
      settings.panel_style === "gradient"
        ? `linear-gradient(145deg, ${start}, ${end})`
        : start,
    color: text(settings.panel_text_color) || "var(--text)",
    borderColor: text(settings.divider_color) || "var(--divider)",
  };
}

function discoveryButtonStyle(settings: Record<string, unknown>): CSSProperties {
  return {
    backgroundColor: text(settings.button_bg_color) || "var(--brand)",
    color: text(settings.button_text_color) || "white",
  };
}

function discoveryHeightClass(value: string): string {
  if (value === "compact") return "lg:h-80";
  if (value === "tall") return "lg:h-[clamp(24rem,34vw,34rem)]";
  return "lg:h-[clamp(20rem,28vw,28rem)]";
}

function discoveryRadiusClass(value: string): string {
  if (value === "square") return "rounded-none";
  if (value === "soft") return "rounded-xl";
  return "rounded-2xl";
}

function discoveryImageOnStart(value: string, index: number): boolean {
  if (value === "right") return false;
  if (value === "alternate") return index % 2 === 0;
  return true;
}

function colorStyle(value: unknown): CSSProperties | undefined {
  return text(value) ? { color: text(value) } : undefined;
}

function focalPoint(value: unknown): number {
  return clampNumber(value, 50, 0, 100);
}

function clampNumber(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

function recordList(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object",
      )
    : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}
