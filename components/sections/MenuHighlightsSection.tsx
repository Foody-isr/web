"use client";

import { useEffect, useState, useRef, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { fetchMenu } from "@/services/api";
import { useCurrency, useI18n } from "@/lib/i18n";
import { useMenuLanguage } from "@/lib/menu-language";
import { tField } from "@/lib/translations";
import { websiteContentUrl } from "@/lib/websiteComponents";
import {
  itemDisplayPriceRange,
  isByWeight,
  weightEstimatePrice,
} from "@/lib/cart";
import { ItemModal } from "@/components/ItemModal";
import { normalizeWebsiteOrder } from "@/lib/websiteOrder";
import { checkRestaurantAvailability } from "@/lib/availability";
import { useWebsiteOrderStore } from "@/store/useWebsiteOrderStore";
import { useCartStore } from "@/store/useCartStore";
import { useRouter } from "next/navigation";
import { usePreviewMode } from "@/lib/preview-mode";
import {
  featuredCarouselOffset,
  featuredEligibleItems,
  featuredItemsDesign,
} from "@/lib/websiteFeaturedItems";
import type { MenuItem } from "@/lib/types";
import type { SectionProps } from "./SectionRenderer";
import { getFieldStyle, ensureFont } from "./typography";
import { getSectionBg } from "./sectionBg";
import {
  styleVariables,
  type CSSVariableStyle,
} from "@/lib/websiteV3Appearance";

type FeaturedItem = {
  id: number;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
};

/** Maps one Menu Highlights section's palette to local semantic variables. */
export function menuHighlightsStyleVariables(
  settings: Record<string, unknown> | null | undefined,
): CSSVariableStyle {
  return styleVariables(settings, [
    ["custom_bg", "--highlight-bg"],
    ["custom_text", "--highlight-text"],
    ["card_bg", "--highlight-card-bg"],
    ["card_text", "--highlight-card-text"],
    ["card_muted", "--highlight-card-muted"],
    ["price_color", "--highlight-price"],
    ["accent_color", "--highlight-accent"],
  ]);
}

/** Resolves the carousel arrow color from the section accent token. */
export function menuHighlightsArrowStyle(): CSSProperties {
  return { color: "var(--highlight-accent, var(--brand))" };
}

/** Selects unique items from public menus, preserving manual choices or seeding a new theme. */
export function selectFeaturedMenuItems(
  menus: { items: (Omit<FeaturedItem, "id"> & { id: string | number })[] }[],
  ids: number[],
  autoSelect: boolean,
  limit = 6,
): FeaturedItem[] {
  const byId = new Map<number, FeaturedItem>();
  for (const item of menus.flatMap((menu) => menu.items)) {
    if (!byId.has(Number(item.id)))
      byId.set(Number(item.id), { ...item, id: Number(item.id) });
  }
  return ids.length
    ? Array.from(new Set(ids))
        .map((id) => byId.get(id))
        .filter((item): item is FeaturedItem => Boolean(item))
    : autoSelect
      ? Array.from(byId.values()).slice(0, limit)
      : [];
}

/** Renders the catalogue carousel/grid and the distinct text-card menu section. */
export function MenuHighlightsSection({ section, restaurant }: SectionProps) {
  const { money } = useCurrency();
  const { t } = useI18n();
  const { menuLocale } = useMenuLanguage();
  const preview = usePreviewMode();
  const router = useRouter();
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [currency, setCurrency] = useState(restaurant.currency ?? "ILS");
  const service = useWebsiteOrderStore(
    (state) => state.selections[String(restaurant.id)]?.orderType ?? "pickup",
  );
  const orderingAvailable =
    !preview &&
    !restaurant.rushMode &&
    !restaurant.ordersPaused &&
    checkRestaurantAvailability(restaurant, service).isOpen;
  const content = section.content || {};
  const settings = section.settings || {};
  const isMenu = section.sectionType === "featured_menu";
  const design = featuredItemsDesign(settings, isMenu);
  const carousel = !isMenu && section.layout === "carousel";
  const bg = getSectionBg(settings);
  const palette = menuHighlightsStyleVariables(settings);
  const orderUrl = `/r/${restaurant.slug || restaurant.id}/order`;
  const itemKey = Array.isArray(content.item_ids)
    ? content.item_ids.map(Number).filter(Number.isFinite).join(",")
    : "";
  const popular = !isMenu && settings.item_source === "popular";
  const autoSelect = settings.auto_select_items === true;
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sequenceRef = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  const [overflow, setOverflow] = useState(false);
  const [motionPaused, setMotionPaused] = useState(false);

  useEffect(() => {
    [
      settings.title_font,
      settings.subtitle_font,
      settings.item_title_font,
      settings.item_description_font,
      settings.item_price_font,
    ].forEach((font) =>
      ensureFont(typeof font === "string" ? font : undefined),
    );
  }, [
    settings.title_font,
    settings.subtitle_font,
    settings.item_title_font,
    settings.item_description_font,
    settings.item_price_font,
  ]);

  useEffect(() => {
    let active = true;
    const ids = itemKey.split(",").filter(Boolean).map(Number);
    setItems([]);
    setLoadError(false);
    if ((!ids.length && !autoSelect && !popular) || !restaurant.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchMenu(String(restaurant.id), undefined, popular ? "popular" : undefined)
      .then((data) => {
        if (!active) return;
        const eligible = featuredEligibleItems(data.menus);
        if (popular && !data.popularItemIds)
          throw new Error("Featured ranking unavailable");
        setCurrency(data.currency);
        const selected = selectFeaturedMenuItems(
          [{ items: eligible }],
          popular
            ? (data.popularItemIds ?? []).map(Number)
            : autoSelect
              ? []
              : ids,
          !popular && autoSelect,
          design.maxItems,
        );
        const selectedIds = (
          popular ? selected.slice(0, design.maxItems) : selected
        ).map((item) => String(item.id));
        setItems(
          selectedIds
            .map((id) => eligible.find((item) => String(item.id) === id)!)
            .filter(Boolean),
        );
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [itemKey, autoSelect, popular, design.maxItems, restaurant.id]);

  // One measured sequence is repeated only when it overflows. Native horizontal
  // scrolling stays available, and keyboard/pointer interaction pauses motion.
  useEffect(() => {
    const viewport = scrollRef.current;
    const sequence = sequenceRef.current;
    if (!carousel || !viewport || !sequence) return;
    const measure = () =>
      setOverflow(sequence.offsetWidth > viewport.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(sequence);
    return () => observer.disconnect();
  }, [carousel, items, design.maxItems, preview]);

  useEffect(() => {
    const viewport = scrollRef.current;
    const sequence = sequenceRef.current;
    if (
      !carousel ||
      !design.autoScroll ||
      !overflow ||
      !viewport ||
      !sequence ||
      motionPaused
    )
      return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let previous = 0;
    const tick = (now: number) => {
      const elapsed = previous ? Math.min(now - previous, 50) : 0;
      previous = now;
      if (!preference.matches && !paused.current && !document.hidden) {
        viewport.scrollLeft = featuredCarouselOffset(
          viewport.scrollLeft,
          elapsed * 0.035 * design.speed * (design.reverse ? -1 : 1),
          sequence.offsetWidth,
        );
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [
    carousel,
    design.autoScroll,
    design.speed,
    design.reverse,
    overflow,
    motionPaused,
    items,
  ]);

  const placeholder = preview && !loading && !loadError && !items.length;
  const shown = placeholder
    ? Array.from(
        { length: isMenu ? 4 : 3 },
        (_, index) =>
          ({
            id: `placeholder-${index}`,
            name: t("websiteFeaturedItem"),
            description: isMenu ? t("websiteFeaturedDescription") : "",
            price: 0,
          }) as MenuItem,
      )
    : autoSelect || popular
      ? items.slice(0, design.maxItems)
      : items;
  const repeated = carousel && design.autoScroll && overflow;
  const sectionStyle = {
    ...bg.style,
    ...palette,
    ...(palette["--highlight-bg"]
      ? { backgroundColor: "var(--highlight-bg)" }
      : {}),
    ...(palette["--highlight-text"] ? { color: "var(--highlight-text)" } : {}),
    "--featured-columns": design.columns,
    "--featured-gap": `${design.spacing}px`,
    "--featured-size": `${design.imageSize}px`,
  } as CSSProperties;

  const cards = (clone = false) =>
    shown.map((item) => {
      const range = isByWeight(item)
        ? { min: weightEstimatePrice(item), max: weightEstimatePrice(item) }
        : itemDisplayPriceRange(item);
      const name = tField(item, "name", menuLocale);
      const description = tField(item, "description", menuLocale);
      return (
        <Link
          key={item.id}
          href={
            item.itemType === "combo"
              ? orderUrl
              : `${orderUrl}?item=${encodeURIComponent(item.id)}`
          }
          tabIndex={clone || placeholder ? -1 : undefined}
          onClick={(event) => {
            if (
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey
            )
              return;
            // Combos use the order page's step picker, not the single-item dialog.
            if (!preview && !placeholder && item.itemType === "combo") return;
            event.preventDefault();
            if (!placeholder) setSelectedItem(item);
          }}
          className="website-featured-card"
          aria-label={name}
        >
          {design.showImages && (
            <div
              className="website-featured-image"
              style={{ aspectRatio: design.imageRatio }}
            >
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt=""
                  fill
                  sizes={
                    carousel
                      ? `${design.imageSize}px`
                      : "(max-width: 640px) 80vw, 33vw"
                  }
                  style={{ objectFit: design.imageFit }}
                />
              ) : (
                <CutleryPlaceholder />
              )}
            </div>
          )}
          <div className="website-featured-copy">
            {design.showItemTitles && (
              <h3
                style={{
                  fontFamily: isMenu
                    ? "var(--font-display)"
                    : "var(--font-body)",
                  ...getFieldStyle(settings, "item_title"),
                }}
              >
                {name}
              </h3>
            )}
            {design.showDescriptions && description && (
              <p
                className="website-featured-description"
                style={getFieldStyle(settings, "item_description")}
              >
                {description}
              </p>
            )}
            {design.showPrices && (
              <p
                className="website-featured-price"
                style={getFieldStyle(settings, "item_price")}
              >
                {money(range.min)}
                {range.max > range.min ? ` – ${money(range.max)}` : ""}
              </p>
            )}
            {design.showBadges &&
              (item.available === false ||
                item.availabilityState === "sold_out") && (
                <span className="website-featured-badge">{t("soldOut")}</span>
              )}
            {design.showButtons && (
              <span className="website-featured-button">
                {String(content.item_button_text || t("websiteOrderNow"))}
              </span>
            )}
          </div>
        </Link>
      );
    });

  if (!loading && !loadError && !shown.length && !preview) return null;
  return (
    <>
      <section
        className={`website-featured ${bg.className}`}
        style={sectionStyle}
        data-kind={isMenu ? "menu" : "items"}
        data-layout={carousel ? "carousel" : "grid"}
        data-full-width={design.fullWidth}
      >
        {((design.showTitle && content.title) ||
          (design.showSubtitle && content.subtitle)) && (
          <header className="website-featured-heading">
            {design.showTitle && content.title && (
              <h2
                data-editor-field="title"
                style={getFieldStyle(settings, "title")}
              >
                {content.title}
              </h2>
            )}
            {design.showSubtitle && content.subtitle && (
              <p
                data-editor-field="subtitle"
                style={getFieldStyle(settings, "subtitle")}
              >
                {content.subtitle}
              </p>
            )}
          </header>
        )}
        {loadError ? (
          <p role="alert" className="website-featured-empty">
            {t("websiteItemsError")}
          </p>
        ) : loading ? (
          <p role="status" className="website-featured-empty">
            {t("websiteFeaturedLoading")}
          </p>
        ) : carousel ? (
          <div
            className="website-featured-carousel"
            ref={scrollRef}
            dir="ltr"
            onPointerEnter={() => {
              paused.current = true;
            }}
            onPointerLeave={(event) => {
              paused.current = event.currentTarget.contains(
                document.activeElement,
              );
            }}
            onFocusCapture={() => {
              paused.current = true;
            }}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget))
                paused.current = event.currentTarget.matches(":hover");
            }}
          >
            <div className="website-featured-track">
              <div
                className="website-featured-sequence"
                ref={sequenceRef}
                dir={menuLocale === "he" ? "rtl" : "ltr"}
              >
                {cards()}
              </div>
              {repeated && (
                <div
                  className="website-featured-sequence"
                  aria-hidden="true"
                  dir={menuLocale === "he" ? "rtl" : "ltr"}
                >
                  {cards(true)}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="website-featured-grid">{cards()}</div>
        )}
        {repeated && (
          <button
            className="website-featured-motion"
            aria-pressed={motionPaused}
            onClick={() => setMotionPaused((value) => !value)}
          >
            {t(motionPaused ? "websiteCarouselPlay" : "websiteCarouselPause")}
          </button>
        )}
        {design.showSectionButton && content.cta_text && (
          <div className="website-featured-footer">
            <Link
              data-editor-field="cta_text"
              className="website-featured-button"
              href={websiteContentUrl(content.cta_link) || orderUrl}
            >
              {content.cta_text}
            </Link>
          </div>
        )}
      </section>
      <ItemModal
        item={selectedItem}
        restaurantName={restaurant.name}
        websiteDesign={normalizeWebsiteOrder({})}
        orderingAvailable={
          orderingAvailable &&
          selectedItem?.available !== false &&
          selectedItem?.availabilityState !== "sold_out"
        }
        onClose={() => setSelectedItem(null)}
        onAdd={(
          item,
          quantity,
          note,
          modifiers,
          variantId,
          variantName,
          variantPrice,
        ) => {
          if (
            !orderingAvailable ||
            item.available === false ||
            item.availabilityState === "sold_out"
          )
            return;
          const cart = useCartStore.getState();
          if (
            cart.lines.length &&
            (cart.restaurantId !== String(restaurant.id) ||
              !cart.canAdd(undefined)) &&
            !window.confirm(t("websiteFeaturedReplaceCart"))
          )
            return;
          cart.setContext(String(restaurant.id), currency);
          cart.setTour(undefined);
          cart.addItem(
            item,
            quantity,
            note,
            modifiers,
            variantId,
            variantName,
            variantPrice,
          );
          router.push(orderUrl);
        }}
      />
    </>
  );
}

function CutleryPlaceholder() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 48 48"
      width="48"
      height="48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m7 5 33 33a3 3 0 0 1-4 4L23 29C13 21 5 14 7 5ZM30 5l-7 7c-3 3-3 6 0 9l-4 4M35 9l-7 7M39 13l-7 7c-3 3-6 3-9 1M16 28 6 38a3 3 0 0 0 4 4l10-10" />
    </svg>
  );
}
